import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

// Clean up the service account key
let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (
  (serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) ||
  (serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'"))
) {
  serviceAccountKey = serviceAccountKey.slice(1, -1);
}
const serviceAccount = JSON.parse(serviceAccountKey);

export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({
      version: "v3",
      auth,
    });

    // FIXED: Only register webhook for Manual Booking Calendar
    const calendarId = process.env.GOOGLE_CALENDAR_ID; // Manual Booking Calendar
    const channelId = uuidv4(); // generate a unique channel ID
    const webhookUrl = process.env.CALENDAR_WEBHOOK_URL; // e.g., https://yourdomain.com/api/google-calendar-webhook

    console.log(`📅 Registering webhook for Manual Booking Calendar: ${calendarId}`);

    const channelConfig = {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
    };

    const response = await calendar.events.watch({
      calendarId,
      requestBody: channelConfig,
    });

    console.log("✅ Manual booking calendar webhook registered successfully:", response.data);
    res.status(200).json({
      message: "Manual booking calendar webhook registered",
      calendarId,
      channelId,
      data: response.data
    });
  } catch (error) {
    console.error("❌ Error registering manual booking calendar webhook:", error);
    res.status(500).json({
      message: "Error registering manual booking calendar webhook",
      error: error.message,
    });
  }
}
