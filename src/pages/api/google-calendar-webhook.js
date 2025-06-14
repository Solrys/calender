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

    // FIXED: Only get the most recently updated events (last 10 minutes) instead of 24 hours
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000); // Only last 10 minutes

    let events = [];
    try {
      console.log(`📅 Fetching events updated since ${tenMinutesAgo.toISOString()} (last 10 minutes only)`);

      const recentRes = await calendar.events.list({
        calendarId,
        updatedMin: tenMinutesAgo.toISOString(),
        singleEvents: true,
        orderBy: "updated",
        maxResults: 5, // Only get the 5 most recent events
        timeZone: 'America/New_York'
      });

      events = recentRes.data.items || [];
      console.log(`📅 Found ${events.length} recently updated events (last 10 minutes)`);

      // ADDITIONAL FILTER: Only process events that were actually created/updated recently
      const veryRecentEvents = events.filter(event => {
        const eventUpdated = new Date(event.updated);
        const timeSinceUpdate = now - eventUpdated.getTime();
        return timeSinceUpdate < 15 * 60 * 1000; // Only events updated in last 15 minutes
      });

      console.log(`📅 Filtered to ${veryRecentEvents.length} very recent events`);
      events = veryRecentEvents;

    } catch (calendarError) {
      console.error("❌ Error fetching calendar events:", calendarError);
      webhookProcessingCache.delete(processingKey);
      return res.status(500).json({ message: "Error fetching calendar events" });
    }

    let bookingsCreated = 0;
    let bookingsSkipped = 0;
    let htmlCleaned = 0;
    let errors = [];

    // Process each event with ENHANCED duplicate protection
    for (const event of events) {
      try {
        // Skip all-day events and events without proper time
        if (!event.start?.dateTime) {
          console.log(`⏭️ Skipping event without dateTime: ${event.summary}`);
          continue;
        }

        // ENHANCED UNIQUE IDENTIFIER TRACKING
        const eventKey = `event_${event.id}`;
        const eventUniqueKey = `${event.id}_${event.updated}`; // Include updated timestamp for uniqueness

        console.log(`\n🔍 Processing event: ${event.summary} (${event.id})`);
        console.log(`   📅 Start: ${event.start.dateTime}`);
        console.log(`   📅 End: ${event.end?.dateTime}`);
        console.log(`   🕐 Updated: ${event.updated}`);
        console.log(`   🔑 Unique Key: ${eventUniqueKey}`);

        // STRICT EVENT-LEVEL RATE LIMITING: Prevent processing same event multiple times
        if (eventProcessingCache.has(eventKey)) {
          const lastEventProcessed = eventProcessingCache.get(eventKey);
          const timeSinceEventProcessed = now - lastEventProcessed;

          if (timeSinceEventProcessed < EVENT_COOLDOWN_MS) {
            console.log(`   🚫 EVENT RATE LIMITED: ${event.id} processed ${timeSinceEventProcessed}ms ago`);
            bookingsSkipped++;
            continue;
          }
        }

        // COMPREHENSIVE DUPLICATE CHECK - Check by calendar event ID
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

        // ADDITIONAL CHECK: Skip if event is too old (created more than 1 hour ago)
        const eventCreated = new Date(event.created);
        const timeSinceCreated = now - eventCreated.getTime();
        if (timeSinceCreated > 60 * 60 * 1000) { // 1 hour
          console.log(`   ⏭️ Skipping old event: Created ${Math.round(timeSinceCreated / (60 * 1000))} minutes ago`);
          continue;
        }

        // Create booking using the FIXED MANUAL CALENDAR FUNCTION
        console.log(`   ✅ Creating new booking for event ${event.id} using MANUAL HANDLER`);

        // Use the new manual calendar event handler for proper timezone handling
        const bookingData = await createBookingFromManualCalendarEvent(event, calendarType);

        console.log(`   📋 Booking data: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime} to ${bookingData.endTime}`);

        // Add enhanced tracking with unique identifiers
        const enhancedBookingData = {
          ...bookingData,
          calendarEventId: event.id,
          calendarEventUpdated: event.updated,
          calendarEventCreated: event.created,
          syncVersion: SYNC_VERSION,
          migrationSafe: new Date(event.start.dateTime) >= MIGRATION_TIMESTAMP,
          lastSyncUpdate: new Date(),
          webhookProcessed: true,
          webhookUniqueKey: eventUniqueKey
        };

        // FINAL RACE CONDITION CHECK before creation
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
        console.log(`      Calendar Event ID: ${newBooking.calendarEventId}`);
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