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
    console.log("🔔 Received Google Calendar push notification:", req.headers);

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
    console.log(`📅 Processing webhook for Manual Booking Calendar: ${calendarId}`);

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch events from the manual booking calendar within the defined time window
    const calendarRes = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = calendarRes.data.items || [];
    console.log(`📅 Fetched ${events.length} events from Manual Booking Calendar`);

    let bookingsCreated = 0;
    let bookingsUpdated = 0;

    // Process each event: upsert the booking data to avoid duplicates
    for (const event of events) {
      try {
        const bookingData = await createBookingFromCalendarEvent(event);

        const result = await Booking.updateOne(
          { calendarEventId: event.id },
          { $set: bookingData },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          console.log(`✅ Created new booking for event: ${event.summary || 'No title'} (${event.id})`);
          bookingsCreated++;
        } else {
          console.log(`✓ Updated existing booking for event: ${event.summary || 'No title'} (${event.id})`);
          bookingsUpdated++;
        }
      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);
      }
    }

    // SAFETY: Mass deletion is still disabled for safety
    console.log("⚠️ Mass deletion disabled for safety - database bookings preserved");

    const message = `Manual booking webhook: ${bookingsCreated} new, ${bookingsUpdated} updated from ${events.length} events`;
    console.log(`✅ ${message}`);

    res.status(200).json({
      message,
      eventsProcessed: events.length,
      bookingsCreated,
      bookingsUpdated,
      calendarType: 'Manual Booking Calendar'
    });
  } catch (error) {
    console.error("❌ Error in manual booking webhook:", error);
    res
      .status(500)
      .json({ message: "Error syncing manual booking events", error: error.message });
  }
}
