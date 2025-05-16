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
    const calendarId =
      "c_067c43f15ee97874539cf2de23bfbd49f37462f9e99243a21da9fcaeb91345bc@group.calendar.google.com"; // Replace if dynamic

    const response = await calendar.events.insert({
      calendarId,
      requestBody: eventData,
    });

    console.log("✅ Calendar event created:", response.data.id);
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

export async function deleteCalendarEvent(eventId) {
  try {
    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID_WEBSITE, // your calendar id
      eventId,
    });
    console.log("Google Calendar event deleted:", eventId);
    return true;
  } catch (error) {
    console.error("Error deleting event from Google Calendar:", error);
    throw error;
  }
}
