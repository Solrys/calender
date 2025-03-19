// pages/api/google-calendar-webhook.js
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

    // Use service account credentials for proper authentication
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

    // Fetch events from the calendar in a defined time window
    const calendarRes = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = calendarRes.data.items || [];
    console.log(`📅 Fetched ${events.length} events from Google Calendar`);

    // Process each event: create booking if not exists, or log that it exists
    for (const event of events) {
      const existingBooking = await Booking.findOne({
        calendarEventId: event.id,
      });
      if (!existingBooking) {
        const newBooking = await createBookingFromCalendarEvent(event);
        console.log("Created new booking from event:", newBooking);
      } else {
        console.log(`Booking for event ${event.id} already exists.`);
      }
    }

    // Identify and delete bookings whose calendar events have been deleted
    const currentEventIds = events.map((event) => event.id);
    const removedResult = await Booking.deleteMany({
      calendarEventId: { $exists: true, $nin: currentEventIds },
    });
    console.log(
      `Deleted ${removedResult.deletedCount} bookings that no longer exist in the calendar.`
    );

    res.status(200).json({ message: "Calendar events processed" });
  } catch (error) {
    console.error("❌ Error syncing calendar events:", error);
    res
      .status(500)
      .json({ message: "Error syncing events", error: error.message });
  }
}
