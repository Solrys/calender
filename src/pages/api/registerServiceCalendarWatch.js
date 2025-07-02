import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Clean up the service account key
let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (
  (serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) ||
  (serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'"))
) {
  serviceAccountKey = serviceAccountKey.slice(1, -1);
}
const serviceAccount = JSON.parse(serviceAccountKey);

// Path to store service calendar watch info (separate from main calendar)
const SERVICE_WATCH_INFO_FILE = path.join(
  process.cwd(),
  "service-calendar-watch-info.json"
);

// Function to read existing service watch info
function getExistingServiceWatchInfo() {
  try {
    if (fs.existsSync(SERVICE_WATCH_INFO_FILE)) {
      const watchData = fs.readFileSync(SERVICE_WATCH_INFO_FILE, "utf8");
      return JSON.parse(watchData);
    }
  } catch (error) {
    console.log(
      "⚠️ Could not read existing service watch info:",
      error.message
    );
  }
  return null;
}

// Function to save service watch info
function saveServiceWatchInfo(watchInfo) {
  try {
    fs.writeFileSync(
      SERVICE_WATCH_INFO_FILE,
      JSON.stringify(watchInfo, null, 2)
    );
    console.log("📝 Service watch info saved successfully");
  } catch (error) {
    console.error("❌ Could not save service watch info:", error.message);
  }
}

// Function to check if a service watch is still valid
function isServiceWatchValid(watchInfo) {
  if (!watchInfo || !watchInfo.expiration) {
    return false;
  }

  const now = Date.now();
  const expiration = parseInt(watchInfo.expiration);
  const timeUntilExpiration = expiration - now;

  // Consider valid if more than 1 hour remaining
  return timeUntilExpiration > 60 * 60 * 1000; // 1 hour in milliseconds
}

// Function to stop an existing service watch
async function stopExistingServiceWatch(calendar, watchInfo) {
  try {
    await calendar.channels.stop({
      requestBody: {
        id: watchInfo.channelId,
        resourceId: watchInfo.resourceId,
      },
    });
    console.log(`✅ Stopped existing service watch: ${watchInfo.channelId}`);
    return true;
  } catch (error) {
    console.log(`⚠️ Could not stop existing service watch: ${error.message}`);
    return false;
  }
}

export default async function handler(req, res) {
  try {
    console.log("🔔 SERVICE CALENDAR WATCH REGISTRATION");
    console.log("=".repeat(50));

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({
      version: "v3",
      auth,
    });

    const serviceCalendarId = process.env.GOOGLE_CALENDAR_ID_WEBSITE_SERVICE;
    const serviceWebhookUrl =
      process.env.SERVICE_CALENDAR_WEBHOOK_URL ||
      `${process.env.NEXTAUTH_URL}/api/service-calendar-webhook`;

    if (!serviceCalendarId) {
      console.error(
        "❌ GOOGLE_CALENDAR_ID_WEBSITE_SERVICE environment variable not set"
      );
      return res.status(500).json({
        message: "Service calendar ID not configured",
        error:
          "GOOGLE_CALENDAR_ID_WEBSITE_SERVICE environment variable missing",
      });
    }

    console.log(`📅 Service Calendar ID: ${serviceCalendarId}`);
    console.log(`🔗 Service Webhook URL: ${serviceWebhookUrl}`);

    // Step 1: Check for existing service watch
    const existingServiceWatch = getExistingServiceWatchInfo();

    if (existingServiceWatch) {
      console.log(
        `\n🔍 Found existing service watch: ${existingServiceWatch.channelId}`
      );
      console.log(`   📅 Registered: ${existingServiceWatch.registeredAt}`);
      console.log(
        `   ⏰ Expires: ${new Date(
          parseInt(existingServiceWatch.expiration)
        ).toISOString()}`
      );

      if (isServiceWatchValid(existingServiceWatch)) {
        const timeRemaining = Math.round(
          (parseInt(existingServiceWatch.expiration) - Date.now()) /
            (60 * 60 * 1000)
        );
        console.log(
          `✅ Existing service watch is still valid (${timeRemaining} hours remaining)`
        );
        console.log("🚫 No new service watch needed - using existing one");

        return res.status(200).json({
          message: "Using existing valid service watch",
          action: "no_action_needed",
          existingWatch: {
            channelId: existingServiceWatch.channelId,
            resourceId: existingServiceWatch.resourceId,
            expiration: existingServiceWatch.expiration,
            hoursRemaining: timeRemaining,
            calendarId: serviceCalendarId,
            webhookUrl: serviceWebhookUrl,
            watchType: "service-calendar",
          },
        });
      } else {
        console.log("⚠️ Existing service watch is expired or expiring soon");
        console.log("🛑 Stopping expired service watch...");
        await stopExistingServiceWatch(calendar, existingServiceWatch);
      }
    } else {
      console.log("\n🔍 No existing service watch found");
    }

    // Step 2: Register new service watch
    console.log("\n🔔 Registering new service calendar watch...");

    const serviceChannelId = `service-calendar-watch-${Date.now()}`;
    console.log(`   🆔 New Service Channel ID: ${serviceChannelId}`);

    const serviceChannelConfig = {
      id: serviceChannelId,
      type: "web_hook",
      address: serviceWebhookUrl,
      params: {
        ttl: "86400", // 24 hours TTL
      },
    };

    const response = await calendar.events.watch({
      calendarId: serviceCalendarId,
      requestBody: serviceChannelConfig,
    });

    console.log("✅ New service calendar watch registered successfully");
    console.log(`   🆔 Channel ID: ${response.data.id}`);
    console.log(`   🔗 Resource ID: ${response.data.resourceId}`);
    console.log(
      `   ⏰ Expiration: ${new Date(
        parseInt(response.data.expiration)
      ).toISOString()}`
    );

    // Step 3: Save new service watch info
    const newServiceWatchInfo = {
      channelId: response.data.id,
      resourceId: response.data.resourceId,
      expiration: response.data.expiration,
      registeredAt: new Date().toISOString(),
      webhookUrl: serviceWebhookUrl,
      calendarId: serviceCalendarId,
      watchType: "service-calendar",
      note: "Service calendar watch - monitors GOOGLE_CALENDAR_ID_WEBSITE_SERVICE for service bookings",
    };

    saveServiceWatchInfo(newServiceWatchInfo);

    console.log("\n🎯 SERVICE CALENDAR WATCH REGISTRATION COMPLETE");
    console.log("   ✅ Only one active service watch at a time");
    console.log("   ✅ Automatic cleanup of expired service watches");
    console.log("   ✅ Prevents duplicate service webhook registrations");
    console.log(
      "   ✅ Service events will be added to ServiceBooking collection"
    );
    console.log("   ✅ Service bookings will appear in Service Dashboard");

    res.status(200).json({
      message: "Service calendar watch registered successfully",
      action: "new_service_watch_created",
      calendarId: serviceCalendarId,
      channelId: response.data.id,
      resourceId: response.data.resourceId,
      expiration: response.data.expiration,
      webhookUrl: serviceWebhookUrl,
      watchType: "service-calendar",
      data: response.data,
    });
  } catch (error) {
    console.error("❌ Error in service calendar watch registration:", error);

    res.status(500).json({
      message: "Error in service calendar watch registration",
      error: error.message,
      watchType: "service-calendar",
    });
  }
}
