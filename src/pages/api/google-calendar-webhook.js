// pages/api/google-calendar-webhook.js
import { google } from "googleapis";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import { createBookingFromCalendarEvent } from "@/utils/createBookingFromEvent";

export default async function handler(req, res) {
  await dbConnect();

  // Allow only POST requests (Google sends push notifications as POST)
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    console.log("🔔 Received Google Calendar push notification:", req.headers);

    // Initialize Google Calendar client.
    const calendar = google.calendar({
      version: "v3",
      auth: process.env.GOOGLE_CALENDAR_API_KEY, // Ensure you have the proper credentials
    });

    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const now = new Date();
    // Define a time window—for example, from now to 30 days ahead.
    const timeMin = now.toISOString();
    const timeMax = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch events within the time window.
    const calendarRes = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = calendarRes.data.items || [];
    console.log(`📅 Fetched ${events.length} events from Google Calendar`);

    // Process each event.
    for (const event of events) {
      // Check if a booking with this calendar event ID already exists.
      const existingBooking = await Booking.findOne({
        calendarEventId: event.id,
      });
      if (!existingBooking) {
        // Create a new booking from the event.
        const newBooking = await createBookingFromCalendarEvent(event);
        console.log("Created new booking from event:", newBooking);
      } else {
        console.log(`Booking for event ${event.id} already exists.`);
      }
    }

    res.status(200).json({ message: "Calendar events processed" });
  } catch (error) {
    console.error("❌ Error syncing calendar events:", error);
    res
      .status(500)
      .json({ message: "Error syncing events", error: error.message });
  }
}
