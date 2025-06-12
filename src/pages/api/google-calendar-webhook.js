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

    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch events from the calendar within the defined time window
    const calendarRes = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = calendarRes.data.items || [];
    console.log(`📅 Fetched ${events.length} events from Google Calendar`);

    // Process each event: upsert the booking data to avoid duplicates
    for (const event of events) {
      const bookingData = await createBookingFromCalendarEvent(event);

      await Booking.updateOne(
        { calendarEventId: event.id },
        { $set: bookingData },
        { upsert: true }
      );
      console.log(`Upserted booking for event ${event.id}`);
    }

    // SAFETY FIX: Disabled dangerous mass deletion that was wiping database
    // This was deleting ALL bookings whose calendar events weren't in 30-day window
    // OLD DANGEROUS CODE (COMMENTED OUT):
    // const currentEventIds = events.map((event) => event.id);
    // const removedResult = await Booking.deleteMany({
    //   calendarEventId: { $exists: true, $nin: currentEventIds },
    // });
    // console.log(`Deleted ${removedResult.deletedCount} bookings that no longer exist in the calendar.`);

    console.log("⚠️ Mass deletion disabled for safety - database bookings preserved");
    console.log("Use calendar-sync.js script for safe syncing of all events");

    res.status(200).json({ message: "Calendar events processed (mass deletion disabled)" });
  } catch (error) {
    console.error("❌ Error syncing calendar events:", error);
    res
      .status(500)
      .json({ message: "Error syncing events", error: error.message });
  }
}
