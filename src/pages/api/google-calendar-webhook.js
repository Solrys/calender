import { google } from "googleapis";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import { createBookingFromCalendarEvent } from "@/utils/createBookingFromEvent";

// MIGRATION SAFETY SETTINGS - Must match calendar-sync.js
const MIGRATION_TIMESTAMP = new Date('2024-06-13T00:00:00Z'); // Only affect events after this date
const SYNC_VERSION = 'v2.0-pacific-timezone'; // Version tag for tracking
const SAFE_MODE = true; // Set to false only when you're confident

// WEBHOOK RATE LIMITING: Simple in-memory cache to prevent duplicate processing
const webhookProcessingCache = new Map();
const WEBHOOK_COOLDOWN_MS = 5000; // 5 seconds cooldown between processing same webhook

// Clean up old entries from cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of webhookProcessingCache.entries()) {
    if (now - timestamp > WEBHOOK_COOLDOWN_MS) {
      webhookProcessingCache.delete(key);
    }
  }
}, 30000); // Clean up every 30 seconds

// Clean up and parse the service account JSON from the environment variable
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
    console.log("🔔 Received Google Calendar push notification");
    console.log(`🛡️ SAFE MODE: ${SAFE_MODE ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📅 Migration Timestamp: ${MIGRATION_TIMESTAMP.toISOString()}`);

    // Get webhook headers to understand what changed
    const resourceId = req.headers['x-goog-resource-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const channelId = req.headers['x-goog-channel-id'];

    console.log(`📋 Webhook Details: State=${resourceState}, Resource=${resourceId}, Channel=${channelId}`);

    // RATE LIMITING: Prevent rapid duplicate webhook calls
    const webhookKey = `${resourceId}_${resourceState}`;
    const webhookNow = Date.now();

    if (webhookProcessingCache.has(webhookKey)) {
      const lastProcessed = webhookProcessingCache.get(webhookKey);
      const timeSinceLastProcessed = webhookNow - lastProcessed;

      if (timeSinceLastProcessed < WEBHOOK_COOLDOWN_MS) {
        console.log(`🚫 RATE LIMITED: Webhook ${webhookKey} processed ${timeSinceLastProcessed}ms ago (cooldown: ${WEBHOOK_COOLDOWN_MS}ms)`);
        return res.status(200).json({
          message: "Webhook rate limited",
          cooldownRemaining: WEBHOOK_COOLDOWN_MS - timeSinceLastProcessed
        });
      }
    }

    // Mark this webhook as being processed
    webhookProcessingCache.set(webhookKey, webhookNow);
    console.log(`🔄 Processing webhook: ${webhookKey} (not rate limited)`);

    // ADDITIONAL SAFETY: Check if we're already processing this exact webhook
    const processingKey = `processing_${webhookKey}`;
    if (webhookProcessingCache.has(processingKey)) {
      console.log(`🚫 ALREADY PROCESSING: Webhook ${webhookKey} is currently being processed`);
      return res.status(200).json({ message: "Webhook already being processed" });
    }

    // Mark as currently processing
    webhookProcessingCache.set(processingKey, webhookNow);

    // Authenticate using the service account
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({
      version: "v3",
      auth,
    });

    // Determine which calendar triggered the webhook
    const manualCalendarId = process.env.GOOGLE_CALENDAR_ID; // Manual Booking Calendar
    const websiteCalendarId = process.env.GOOGLE_CALENDAR_ID_WEBSITE; // Website Booking Calendar

    // For now, we'll process the manual calendar (where admin creates events)
    // Website calendar events are created by the system, so we don't need to sync them back
    const calendarId = manualCalendarId;
    const calendarType = "Manual Booking Calendar";

    console.log(`📅 Processing webhook for ${calendarType}`);

    // WEBHOOK SPAM PROTECTION: Add delay for processing
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay

    // Handle different webhook states
    if (resourceState === 'sync') {
      console.log("🔄 Initial sync notification - no action needed");
      return res.status(200).json({ message: "Sync notification received" });
    }

    // For exists/not_exists states, we need to check what actually changed
    // EFFICIENT APPROACH: First try to get recently updated events
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    console.log(`📅 Checking for events updated since ${oneDayAgo.toDateString()}`);

    let events = [];
    try {
      // First, try to get recently updated events (more efficient)
      const recentRes = await calendar.events.list({
        calendarId,
        updatedMin: oneDayAgo.toISOString(),
        singleEvents: true,
        orderBy: "updated",
        maxResults: 100
      });

      const recentEvents = recentRes.data.items || [];
      console.log(`📅 Found ${recentEvents.length} recently updated events`);

      // If we found recent events, use those
      if (recentEvents.length > 0) {
        events = recentEvents;
      } else {
        // Fallback: Check a broader range for new events
        const sixMonthsFromNow = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
        console.log(`📅 Fallback: Checking events from ${oneDayAgo.toDateString()} to ${sixMonthsFromNow.toDateString()}`);

        const calendarRes = await calendar.events.list({
          calendarId,
          timeMin: oneDayAgo.toISOString(),
          timeMax: sixMonthsFromNow.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 500
        });
        events = calendarRes.data.items || [];
      }
    } catch (calendarError) {
      console.error("❌ Error fetching calendar events:", calendarError);
      return res.status(500).json({ message: "Error fetching calendar events" });
    }

    console.log(`📅 Found ${events.length} events in recent timeframe`);

    let bookingsCreated = 0;
    let bookingsUpdated = 0;
    let bookingsSkipped = 0;
    let bookingsProtected = 0;

    // Process each event with migration safety
    for (const event of events) {
      try {
        // Skip all-day events
        if (!event.start.dateTime) {
          console.log(`⏭️ Skipping all-day event: ${event.summary}`);
          continue;
        }

        const eventDate = new Date(event.start.dateTime);
        console.log(`\n🔍 Processing event: ${event.summary} (${event.id})`);
        console.log(`   📅 Event date: ${event.start.dateTime}`);
        console.log(`   🕐 Event timezone: ${event.start.timeZone || 'Not specified'}`);

        // ROBUST DUPLICATE DETECTION: Check if ANY booking exists with this calendar event ID
        const existingBookings = await Booking.find({ calendarEventId: event.id });

        if (existingBookings.length > 0) {
          console.log(`   ⚠️ DUPLICATE DETECTED: ${existingBookings.length} booking(s) already exist for event ${event.id}`);
          existingBookings.forEach((booking, index) => {
            console.log(`      ${index + 1}. ${booking.customerName || 'No name'} - ${booking.startDate.toISOString().split('T')[0]} ${booking.startTime}`);
          });

          // If multiple bookings exist for the same event, this is a problem
          if (existingBookings.length > 1) {
            console.log(`   🚨 CRITICAL: Multiple bookings found for same calendar event! This should not happen.`);
          }

          bookingsSkipped++;
          continue;
        }

        // FINAL SAFETY CHECK: Double-check right before creating
        const finalCheck = await Booking.findOne({ calendarEventId: event.id });
        if (finalCheck) {
          console.log(`   ⚠️ RACE CONDITION PREVENTED: Booking created between checks for ${event.id}`);
          bookingsSkipped++;
          continue;
        }

        // CREATE: New manual booking from calendar event
        console.log(`   ✅ Creating new booking for event ${event.id}`);
        const bookingData = await createBookingFromCalendarEvent(event, calendarType);

        console.log(`   📋 Booking data: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime}-${bookingData.endTime}`);

        // MIGRATION SAFETY: Add migration tracking for new bookings
        const safeBookingData = {
          ...bookingData,
          calendarEventId: event.id,
          syncVersion: SYNC_VERSION,
          migrationSafe: eventDate >= MIGRATION_TIMESTAMP,
          lastSyncUpdate: new Date()
        };

        try {
          const newBooking = await Booking.create(safeBookingData);
          console.log(`   ✅ CREATED manual booking: "${event.summary || 'No title'}" (${event.id}) - Safe: ${eventDate >= MIGRATION_TIMESTAMP}`);
          console.log(`      Database ID: ${newBooking._id}`);
          bookingsCreated++;
        } catch (createError) {
          if (createError.code === 11000) {
            // Duplicate key error - booking already exists
            console.log(`   ⚠️ DUPLICATE PREVENTED: Booking already exists for ${event.id} (MongoDB duplicate key error)`);
            bookingsSkipped++;
          } else {
            console.error(`   ❌ CREATE ERROR: ${createError.message}`);
            throw createError;
          }
        }
      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);
      }
    }

    // HANDLE INDIVIDUAL EVENT DELETIONS with migration safety
    let bookingsDeleted = 0;

    // Get all manual bookings (from admin calendar) that should exist
    const manualBookings = await Booking.find({
      paymentStatus: "manual",
      calendarEventId: { $exists: true, $ne: null, $ne: "" }
    });

    console.log(`🔍 Checking ${manualBookings.length} manual bookings for deleted events`);

    // Check each manual booking to see if its calendar event still exists
    for (const booking of manualBookings) {
      try {
        // MIGRATION SAFETY: Only check deletions for migration-safe bookings
        if (SAFE_MODE && !booking.migrationSafe) {
          console.log(`🛡️ PROTECTED from deletion check: "${booking.customerName || 'No name'}" (pre-migration)`);
          continue;
        }

        // Try to fetch the specific event
        await calendar.events.get({
          calendarId,
          eventId: booking.calendarEventId
        });
        // Event exists, no action needed
      } catch (eventError) {
        if (eventError.code === 404) {
          // Event was deleted from calendar, delete the booking (only if migration-safe)
          if (booking.migrationSafe || !SAFE_MODE) {
            await Booking.deleteOne({ _id: booking._id });
            console.log(`🗑️ DELETED booking for removed event: "${booking.customerName || 'No name'}" (${booking.calendarEventId})`);
            bookingsDeleted++;
          } else {
            console.log(`🛡️ PROTECTED from deletion: "${booking.customerName || 'No name'}" (pre-migration)`);
          }
        } else {
          console.error(`❌ Error checking event ${booking.calendarEventId}:`, eventError);
        }
      }
    }

    const message = `Webhook: ${bookingsCreated} created, ${bookingsUpdated} updated, ${bookingsSkipped} skipped, ${bookingsProtected} protected, ${bookingsDeleted} deleted`;
    console.log(`✅ ${message}`);

    // Clean up processing flag
    const cleanupProcessingKey = `processing_${resourceId}_${resourceState}`;
    webhookProcessingCache.delete(cleanupProcessingKey);

    res.status(200).json({
      message,
      eventsProcessed: events.length,
      bookingsCreated,
      bookingsUpdated,
      bookingsSkipped,
      bookingsProtected,
      bookingsDeleted,
      calendarType,
      resourceState,
      migrationTimestamp: MIGRATION_TIMESTAMP.toISOString(),
      safeMode: SAFE_MODE,
      syncVersion: SYNC_VERSION,
      timeRange: `Recently updated events since ${oneDayAgo.toDateString()}`
    });
  } catch (error) {
    console.error("❌ Error in calendar webhook:", error);

    // Clean up processing flag on error
    const errorProcessingKey = `processing_${req.headers['x-goog-resource-id']}_${req.headers['x-goog-resource-state']}`;
    webhookProcessingCache.delete(errorProcessingKey);

    res
      .status(500)
      .json({ message: "Error processing calendar webhook", error: error.message });
  }
}
