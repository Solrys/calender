import { google } from "googleapis";
import path from "path";

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
async function createCalendarEvent(eventData) {
  const keyFilePath = path.resolve(process.cwd(), "service-account.json");
  const auth = new google.auth.GoogleAuth({
    keyFile: serviceAccount, // Your service account key file
    scopes: SCOPES,
  });

  const authClient = await auth.getClient();

  // Optionally, set the global authentication
  google.options({ auth: authClient });

  // Use the Calendar API
  const calendar = google.calendar("v3");

  const response = await calendar.events.insert({
    calendarId:
      "c_b8b92cc3940cbfcfb4cfcf31fbf2530b8f28c4626932af48d0c2c6f7f92d8b2f@group.calendar.google.com", // Replace with your calendar ID if different
    requestBody: eventData,
  });

  return response.data;
}

export default createCalendarEvent;
export async function deleteCalendarEvent(eventId) {
  try {
    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID, // your calendar id
      eventId,
    });
    console.log("Google Calendar event deleted:", eventId);
    return true;
  } catch (error) {
    console.error("Error deleting event from Google Calendar:", error);
    throw error;
  }
}
