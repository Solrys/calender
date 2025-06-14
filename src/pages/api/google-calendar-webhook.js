import { google } from "googleapis";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import { createBookingFromCalendarEvent } from "@/utils/createBookingFromEvent";
import { createBookingFromManualCalendarEvent } from "@/utils/manualCalendarEventHandler";

// MIGRATION SAFETY SETTINGS - Must match calendar-sync.js
const MIGRATION_TIMESTAMP = new Date('2024-06-13T00:00:00Z');
const SYNC_VERSION = 'v2.4-manual-calendar-fix';
const SAFE_MODE = true;

// ENHANCED WEBHOOK RATE LIMITING with event-specific tracking
const webhookProcessingCache = new Map();
const eventProcessingCache = new Map(); // NEW: Track individual events
const WEBHOOK_COOLDOWN_MS = 15000; // Increased to 15 seconds
const EVENT_COOLDOWN_MS = 30000; // 30 seconds for individual events
const PROCESSING_TIMEOUT_MS = 45000; // 45 seconds max processing time

// Clean up old entries from cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of webhookProcessingCache.entries()) {
    if (now - timestamp > Math.max(WEBHOOK_COOLDOWN_MS, PROCESSING_TIMEOUT_MS)) {
      webhookProcessingCache.delete(key);
    }
  }
  for (const [key, timestamp] of eventProcessingCache.entries()) {
    if (now - timestamp > EVENT_COOLDOWN_MS) {
      eventProcessingCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

// HTML cleanup utility
function cleanHTMLFromText(text) {
  if (!text) return "";

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Decode common HTML entities
  text = text.replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return text.trim();
}

// Clean up and parse the service account JSON
let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (
  (serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) ||
  (serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'"))
) {
  serviceAccountKey = serviceAccountKey.slice(1, -1);
}
const serviceAccount = JSON.parse(serviceAccountKey);

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    console.log("🔔 Received Google Calendar push notification (FIXED)");

    // Get webhook headers
    const resourceId = req.headers['x-goog-resource-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const channelId = req.headers['x-goog-channel-id'];

    console.log(`📋 Webhook Details: State=${resourceState}, Resource=${resourceId}, Channel=${channelId}`);

    // ENHANCED RATE LIMITING: Use multiple factors for webhook deduplication
    const webhookKey = `${resourceId}_${resourceState}_${channelId}`;
    const processingKey = `processing_${webhookKey}`;
    const now = Date.now();

    // Check if we're currently processing this webhook
    if (webhookProcessingCache.has(processingKey)) {
      const processingStartTime = webhookProcessingCache.get(processingKey);
      const processingDuration = now - processingStartTime;

      if (processingDuration < PROCESSING_TIMEOUT_MS) {
        console.log(`🚫 ALREADY PROCESSING: Webhook ${webhookKey} started ${processingDuration}ms ago`);
        return res.status(200).json({
          message: "Webhook already being processed",
          processingDuration
        });
      } else {
        console.log(`⚠️ PROCESSING TIMEOUT: Cleaning up stale processing flag for ${webhookKey}`);
        webhookProcessingCache.delete(processingKey);
      }
    }

    // Check recent processing history
    if (webhookProcessingCache.has(webhookKey)) {
      const lastProcessed = webhookProcessingCache.get(webhookKey);
      const timeSinceLastProcessed = now - lastProcessed;

      if (timeSinceLastProcessed < WEBHOOK_COOLDOWN_MS) {
        console.log(`🚫 RATE LIMITED: Webhook ${webhookKey} processed ${timeSinceLastProcessed}ms ago`);
        return res.status(200).json({
          message: "Webhook rate limited",
          cooldownRemaining: WEBHOOK_COOLDOWN_MS - timeSinceLastProcessed
        });
      }
    }

    // Mark as currently processing
    webhookProcessingCache.set(processingKey, now);
    console.log(`🔄 Processing webhook: ${webhookKey}`);

    // Add processing delay to handle rapid webhook calls
    await new Promise(resolve => setTimeout(resolve, 3000)); // Increased to 3 seconds

    // Handle sync notifications
    if (resourceState === 'sync') {
      console.log("🔄 Initial sync notification - no action needed");
      webhookProcessingCache.delete(processingKey);
      webhookProcessingCache.set(webhookKey, now);
      return res.status(200).json({ message: "Sync notification received" });
    }

    // Authenticate with Google Calendar
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const calendarType = "Manual Booking Calendar";

    // Get recently updated events
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    let events = [];
    try {
      console.log(`📅 Fetching events updated since ${oneDayAgo.toISOString()}`);

      const recentRes = await calendar.events.list({
        calendarId,
        updatedMin: oneDayAgo.toISOString(),
        singleEvents: true,
        orderBy: "updated",
        maxResults: 25, // Reduced further for efficiency
        timeZone: 'America/New_York'
      });

      events = recentRes.data.items || [];
      console.log(`📅 Found ${events.length} recently updated events`);

    } catch (calendarError) {
      console.error("❌ Error fetching calendar events:", calendarError);
      webhookProcessingCache.delete(processingKey);
      return res.status(500).json({ message: "Error fetching calendar events" });
    }

    let bookingsCreated = 0;
    let bookingsSkipped = 0;
    let htmlCleaned = 0;
    let errors = [];

    // Process each event with FIXED duplicate protection
    for (const event of events) {
      try {
        // Skip all-day events and events without proper time
        if (!event.start?.dateTime) {
          console.log(`⏭️ Skipping event without dateTime: ${event.summary}`);
          continue;
        }

        // EVENT-LEVEL RATE LIMITING: Prevent processing same event multiple times
        const eventKey = `event_${event.id}`;
        if (eventProcessingCache.has(eventKey)) {
          const lastEventProcessed = eventProcessingCache.get(eventKey);
          const timeSinceEventProcessed = now - lastEventProcessed;

          if (timeSinceEventProcessed < EVENT_COOLDOWN_MS) {
            console.log(`🚫 EVENT RATE LIMITED: ${event.id} processed ${timeSinceEventProcessed}ms ago`);
            bookingsSkipped++;
            continue;
          }
        }

        console.log(`\n🔍 Processing event: ${event.summary} (${event.id})`);
        console.log(`   📅 Start: ${event.start.dateTime}`);
        console.log(`   📅 End: ${event.end?.dateTime}`);

        // COMPREHENSIVE DUPLICATE CHECK - FIXED
        const existingBookings = await Booking.find({ calendarEventId: event.id });

        if (existingBookings.length > 0) {
          console.log(`   ⚠️ DUPLICATE DETECTED: ${existingBookings.length} booking(s) already exist for event ${event.id}`);

          // Clean HTML from existing bookings if needed
          for (const booking of existingBookings) {
            if (booking.customerName && booking.customerName.includes('<')) {
              const cleanedName = cleanHTMLFromText(booking.customerName);
              if (cleanedName !== booking.customerName) {
                await Booking.findByIdAndUpdate(booking._id, {
                  customerName: cleanedName,
                  lastCleanupUpdate: new Date()
                });
                console.log(`   🧹 Fixed HTML in existing booking: "${booking.customerName}" → "${cleanedName}"`);
                htmlCleaned++;
              }
            }
          }

          bookingsSkipped++;
          eventProcessingCache.set(eventKey, now); // Mark event as processed
          continue;
        }

        // Create booking using the NEW MANUAL CALENDAR FUNCTION for proper timezone handling
        console.log(`   ✅ Creating new booking for event ${event.id} using MANUAL HANDLER`);

        // Use the new manual calendar event handler instead of the original function
        const bookingData = await createBookingFromManualCalendarEvent(event, calendarType);

        // The new function already cleans HTML, so no need to clean again
        console.log(`   📋 Booking data from manual handler: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime} to ${bookingData.endTime}`);

        // Add enhanced tracking without overriding the core data
        const enhancedBookingData = {
          ...bookingData,
          calendarEventId: event.id,
          syncVersion: SYNC_VERSION,
          migrationSafe: new Date(event.start.dateTime) >= MIGRATION_TIMESTAMP,
          lastSyncUpdate: new Date(),
          webhookProcessed: true
        };

        // Final duplicate check before creation
        const finalCheck = await Booking.findOne({ calendarEventId: event.id });
        if (finalCheck) {
          console.log(`   ⚠️ RACE CONDITION PREVENTED: Booking created during processing`);
          bookingsSkipped++;
          eventProcessingCache.set(eventKey, now);
          continue;
        }

        const newBooking = await Booking.create(enhancedBookingData);
        console.log(`   ✅ CREATED: ${newBooking.customerName || 'No name'} - ${newBooking.startTime} to ${newBooking.endTime}`);
        console.log(`      Database ID: ${newBooking._id}`);
        bookingsCreated++;
        eventProcessingCache.set(eventKey, now); // Mark event as processed

      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);
        errors.push(`Event ${event.id}: ${eventError.message}`);
      }
    }

    // Clean up processing flag and set completion timestamp
    webhookProcessingCache.delete(processingKey);
    webhookProcessingCache.set(webhookKey, now);

    const message = `Fixed Webhook: ${bookingsCreated} created, ${bookingsSkipped} skipped, ${htmlCleaned} HTML cleaned${errors.length > 0 ? `, ${errors.length} errors` : ''}`;
    console.log(`✅ ${message}`);

    res.status(200).json({
      message,
      eventsProcessed: events.length,
      bookingsCreated,
      bookingsSkipped,
      htmlCleaned,
      errors: errors.length > 0 ? errors : undefined,
      processingTimeMs: Date.now() - now,
      calendarType,
      resourceState,
      safeMode: SAFE_MODE,
      syncVersion: SYNC_VERSION,
      fixed: true
    });

  } catch (error) {
    console.error("❌ Error in fixed calendar webhook:", error);

    // Clean up processing flag on error
    const errorProcessingKey = `processing_${req.headers['x-goog-resource-id']}_${req.headers['x-goog-resource-state']}_${req.headers['x-goog-channel-id']}`;
    webhookProcessingCache.delete(errorProcessingKey);

    res.status(500).json({
      message: "Error processing fixed calendar webhook",
      error: error.message
    });
  }
}