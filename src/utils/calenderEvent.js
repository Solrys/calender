import { google } from "googleapis";
import path from "path";

// Define the scope required for Calendar API
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

async function createCalendarEvent(eventData) {
  const keyFilePath = path.resolve(process.cwd(), "service-account.json");
  const auth = new google.auth.GoogleAuth({
    keyFile: "service-account.json", // Your service account key file
    scopes: SCOPES,
  });

  const authClient = await auth.getClient();

  // Optionally, set the global authentication
  google.options({ auth: authClient });

  // Use the Calendar API
  const calendar = google.calendar("v3");

  const response = await calendar.events.insert({
    calendarId:
      "c_8891de9cc21f58309989f6c1304b8b535ac24a9b87959fdf4bed17536ebc733f@group.calendar.google.com", // Replace with your calendar ID if different
    requestBody: eventData,
  });

  return response.data;
}

export default createCalendarEvent;
