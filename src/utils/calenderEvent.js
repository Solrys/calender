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
      "c_9ccd192c439a88a8d139b83643e2229a4b332b8ce642bef42a6b85516e54475a@group.calendar.google.com", // Replace with your calendar ID if different
    requestBody: eventData,
  });

  return response.data;
}

export default createCalendarEvent;
