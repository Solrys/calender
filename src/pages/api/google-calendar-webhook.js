import { google } from "googleapis";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import { createBookingFromCalendarEvent } from "@/utils/createBookingFromEvent";

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

    // Get webhook headers to understand what changed
    const resourceId = req.headers['x-goog-resource-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const channelId = req.headers['x-goog-channel-id'];

    console.log(`📋 Webhook Details: State=${resourceState}, Resource=${resourceId}, Channel=${channelId}`);

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

    // Handle different webhook states
    if (resourceState === 'sync') {
      console.log("🔄 Initial sync notification - no action needed");
      return res.status(200).json({ message: "Sync notification received" });
    }

    // For exists/not_exists states, we need to check what actually changed
    // Get recent events to see what was added/modified/deleted
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Next week

    console.log(`📅 Checking events from ${oneDayAgo.toDateString()} to ${oneWeekFromNow.toDateString()}`);

    let events = [];
    try {
      const calendarRes = await calendar.events.list({
        calendarId,
        timeMin: oneDayAgo.toISOString(),
        timeMax: oneWeekFromNow.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 100
      });
      events = calendarRes.data.items || [];
    } catch (calendarError) {
      console.error("❌ Error fetching calendar events:", calendarError);
      return res.status(500).json({ message: "Error fetching calendar events" });
    }

    console.log(`📅 Found ${events.length} events in recent timeframe`);

    let bookingsCreated = 0;
    let bookingsUpdated = 0;
    let bookingsSkipped = 0;

    // Process each event
    for (const event of events) {
      try {
        // Skip all-day events
        if (!event.start.dateTime) {
          console.log(`⏭️ Skipping all-day event: ${event.summary}`);
          continue;
        }

        // Check if booking already exists
        const existingBooking = await Booking.findOne({ calendarEventId: event.id });

        if (!existingBooking) {
          // CREATE: New manual booking from calendar event
          const bookingData = await createBookingFromCalendarEvent(event);

          await Booking.create({
            ...bookingData,
            calendarEventId: event.id,
            paymentStatus: "manual" // Manual bookings from admin calendar
          });

          console.log(`✅ CREATED manual booking: "${event.summary || 'No title'}" (${event.id})`);
          bookingsCreated++;
        } else {
          // CHECK: Only update if event was actually modified
          const eventLastModified = new Date(event.updated);
          const bookingLastModified = new Date(existingBooking.updatedAt || existingBooking.createdAt);

          if (eventLastModified > bookingLastModified) {
            // UPDATE: Event was modified after booking
            const bookingData = await createBookingFromCalendarEvent(event);

            await Booking.updateOne(
              { calendarEventId: event.id },
              { $set: bookingData }
            );

            console.log(`📝 UPDATED booking (event modified): "${event.summary || 'No title'}" (${event.id})`);
            bookingsUpdated++;
          } else {
            // SKIP: No changes needed
            console.log(`✓ SKIPPED (no changes): "${event.summary || 'No title'}" (${event.id})`);
            bookingsSkipped++;
          }
        }
      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);
      }
    }

    // HANDLE INDIVIDUAL EVENT DELETIONS
    // Check if any database bookings have calendar events that no longer exist
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
        // Try to fetch the specific event
        await calendar.events.get({
          calendarId,
          eventId: booking.calendarEventId
        });
        // Event exists, no action needed
      } catch (eventError) {
        if (eventError.code === 404) {
          // Event was deleted from calendar, delete the booking
          await Booking.deleteOne({ _id: booking._id });
          console.log(`🗑️ DELETED booking for removed event: "${booking.customerName || 'No name'}" (${booking.calendarEventId})`);
          bookingsDeleted++;
        } else {
          console.error(`❌ Error checking event ${booking.calendarEventId}:`, eventError);
        }
      }
    }

    const message = `Webhook: ${bookingsCreated} created, ${bookingsUpdated} updated, ${bookingsSkipped} skipped, ${bookingsDeleted} deleted`;
    console.log(`✅ ${message}`);

    res.status(200).json({
      message,
      eventsProcessed: events.length,
      bookingsCreated,
      bookingsUpdated,
      bookingsSkipped,
      bookingsDeleted,
      calendarType,
      resourceState,
      timeRange: `${oneDayAgo.toDateString()} to ${oneWeekFromNow.toDateString()}`
    });
  } catch (error) {
    console.error("❌ Error in calendar webhook:", error);
    res
      .status(500)
      .json({ message: "Error processing calendar webhook", error: error.message });
  }
}
