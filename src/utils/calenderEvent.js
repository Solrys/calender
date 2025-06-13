import { google } from "googleapis";

// Define the scope required for Calendar API
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (
  (serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) ||
  (serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'"))
) {
  serviceAccountKey = serviceAccountKey.slice(1, -1);
}
const serviceAccount = JSON.parse(serviceAccountKey);
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount, // Your service account key file
  scopes: SCOPES,
});

const authClient = await auth.getClient();

// Optionally, set the global authentication
google.options({ auth: authClient });

// Use the Calendar API
const calendar = google.calendar("v3");

async function createCalendarEvent(eventData) {
  try {
    // UPDATED: Use Website Booking Calendar for website bookings
    // Manual bookings are created directly in Manual Booking Calendar by admin
    const calendarId = process.env.GOOGLE_CALENDAR_ID_WEBSITE;

    // UPDATED: Ensure timezone is Pacific Time for LA client
    if (eventData.start && eventData.start.dateTime) {
      eventData.start.timeZone = "America/Los_Angeles";
    }
    if (eventData.end && eventData.end.dateTime) {
      eventData.end.timeZone = "America/Los_Angeles";
    }

    const response = await calendar.events.insert({
      calendarId,
      requestBody: eventData,
    });

    console.log("✅ Website booking calendar event created:", response.data.id);
    return response.data;
  } catch (error) {
    console.error("❌ Failed to create calendar event");

    // Print full error details for debugging
    if (error.errors || error.response?.data) {
      console.error(
        "🧩 Google API Error:",
        JSON.stringify(error.response?.data || error.errors, null, 2)
      );
    }

    // Optional: Customize error message
    throw new Error(
      error.message || "Unknown error occurred while creating calendar event"
    );
  }
}

export default createCalendarEvent;

export async function deleteCalendarEvent(eventId, bookingType = "website") {
  try {
    // UPDATED: Delete from appropriate calendar based on booking type
    let calendarId;

    if (bookingType === "manual") {
      // Manual bookings are in the Manual Booking Calendar
      calendarId = process.env.GOOGLE_CALENDAR_ID;
    } else {
      // Website bookings are in the Website Booking Calendar
      calendarId = process.env.GOOGLE_CALENDAR_ID_WEBSITE;
    }

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    console.log(`✅ Calendar event deleted from ${bookingType} calendar:`, eventId);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting event from ${bookingType} calendar:`, error);
    throw error;
  }
}
