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

    // Authenticate using the service account
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({
      version: "v3",
      auth,
    });

    // FIXED: Only handle Manual Booking Calendar (where users manually create bookings)
    const calendarId = process.env.GOOGLE_CALENDAR_ID; // Manual Booking Calendar
    console.log(`📅 Processing webhook for Manual Booking Calendar`);

    // FIXED: Extended time range - fetch from 30 days ago to 1 year in future
    // This ensures we catch all events that might be created/modified
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const timeMin = thirtyDaysAgo.toISOString();
    const timeMax = oneYearFromNow.toISOString();

    console.log(`📅 Fetching events from ${thirtyDaysAgo.toDateString()} to ${oneYearFromNow.toDateString()}`);

    // Fetch events from the manual booking calendar within the extended time window
    const calendarRes = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 500 // Increased limit to catch more events
    });

    const events = calendarRes.data.items || [];
    console.log(`📅 Fetched ${events.length} events from Manual Booking Calendar`);

    let bookingsCreated = 0;
    let bookingsUpdated = 0;
    let bookingsSkipped = 0;

    // Get all current calendar event IDs to detect deletions
    const currentEventIds = events.map(event => event.id);

    // Process each event: only update if actually changed
    for (const event of events) {
      try {
        // Check if booking already exists
        const existingBooking = await Booking.findOne({ calendarEventId: event.id });

        const bookingData = await createBookingFromCalendarEvent(event);

        if (!existingBooking) {
          // CREATE: New booking
          await Booking.create({
            ...bookingData,
            calendarEventId: event.id
          });
          console.log(`✅ CREATED new booking: "${event.summary || 'No title'}" (${event.id})`);
          bookingsCreated++;
        } else {
          // CHECK: Only update if event was actually modified
          const eventLastModified = new Date(event.updated);
          const bookingLastModified = new Date(existingBooking.updatedAt || existingBooking.createdAt);

          if (eventLastModified > bookingLastModified) {
            // UPDATE: Event was modified after booking
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

    // HANDLE DELETIONS: Remove bookings for deleted calendar events
    let bookingsDeleted = 0;
    const deletedBookings = await Booking.find({
      calendarEventId: { $exists: true, $nin: currentEventIds },
      paymentStatus: "manual" // Only delete manual bookings, not website bookings
    });

    if (deletedBookings.length > 0) {
      console.log(`🗑️ Found ${deletedBookings.length} bookings for deleted calendar events`);

      for (const booking of deletedBookings) {
        await Booking.deleteOne({ _id: booking._id });
        console.log(`🗑️ DELETED booking for removed event: "${booking.customerName || 'No name'}" (${booking.calendarEventId})`);
        bookingsDeleted++;
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
      calendarType: 'Manual Booking Calendar',
      timeRange: `${thirtyDaysAgo.toDateString()} to ${oneYearFromNow.toDateString()}`
    });
  } catch (error) {
    console.error("❌ Error in manual booking webhook:", error);
    res
      .status(500)
      .json({ message: "Error syncing manual booking events", error: error.message });
  }
}
