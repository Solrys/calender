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

    // Process each event: upsert the booking data to avoid duplicates
    for (const event of events) {
      try {
        // Check if booking already exists
        const existingBooking = await Booking.findOne({ calendarEventId: event.id });

        const bookingData = await createBookingFromCalendarEvent(event);

        const result = await Booking.updateOne(
          { calendarEventId: event.id },
          { $set: bookingData },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          console.log(`✅ CREATED new booking: "${event.summary || 'No title'}" (${event.id})`);
          bookingsCreated++;
        } else if (result.modifiedCount > 0) {
          console.log(`📝 UPDATED existing booking: "${event.summary || 'No title'}" (${event.id})`);
          bookingsUpdated++;
        } else {
          console.log(`✓ SKIPPED (no changes): "${event.summary || 'No title'}" (${event.id})`);
          bookingsSkipped++;
        }
      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);
      }
    }

    // SAFETY: Mass deletion is still disabled for safety
    console.log("⚠️ Mass deletion disabled for safety - database bookings preserved");

    const message = `Webhook processed: ${bookingsCreated} created, ${bookingsUpdated} updated, ${bookingsSkipped} skipped`;
    console.log(`✅ ${message}`);

    res.status(200).json({
      message,
      eventsProcessed: events.length,
      bookingsCreated,
      bookingsUpdated,
      bookingsSkipped,
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
