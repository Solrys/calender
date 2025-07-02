import fs from "fs";
import path from "path";

// Path to service calendar watch info
const SERVICE_WATCH_INFO_FILE = path.join(
  process.cwd(),
  "service-calendar-watch-info.json"
);

// Function to read service watch info
function getServiceWatchInfo() {
  try {
    if (fs.existsSync(SERVICE_WATCH_INFO_FILE)) {
      const watchData = fs.readFileSync(SERVICE_WATCH_INFO_FILE, "utf8");
      return JSON.parse(watchData);
    }
  } catch (error) {
    console.log("⚠️ Could not read service watch info:", error.message);
  }
  return null;
}

// Function to check if service watch is valid
function isServiceWatchValid(watchInfo) {
  if (!watchInfo || !watchInfo.expiration) {
    return false;
  }

  const now = Date.now();
  const expiration = parseInt(watchInfo.expiration);
  const timeUntilExpiration = expiration - now;

  // Consider valid if more than 1 hour remaining
  return timeUntilExpiration > 60 * 60 * 1000;
}

export default async function handler(req, res) {
  try {
    console.log("🔍 Checking Service Calendar Watch Status");
    console.log("=".repeat(40));

    const serviceWatch = getServiceWatchInfo();

    if (!serviceWatch) {
      console.log("❌ No service calendar watch found");
      return res.status(200).json({
        hasServiceWatch: false,
        message: "No service calendar watch registered",
        recommendation:
          "Register a new service calendar watch using /api/registerServiceCalendarWatch",
      });
    }

    const now = Date.now();
    const expiration = parseInt(serviceWatch.expiration);
    const timeUntilExpiration = expiration - now;
    const hoursRemaining = Math.round(timeUntilExpiration / (60 * 60 * 1000));
    const isValid = isServiceWatchValid(serviceWatch);

    console.log(`📋 Service Watch Details:`);
    console.log(`   🆔 Channel ID: ${serviceWatch.channelId}`);
    console.log(`   🔗 Resource ID: ${serviceWatch.resourceId}`);
    console.log(`   📅 Registered: ${serviceWatch.registeredAt}`);
    console.log(`   ⏰ Expires: ${new Date(expiration).toISOString()}`);
    console.log(`   ⏳ Hours Remaining: ${hoursRemaining}`);
    console.log(`   ✅ Valid: ${isValid ? "Yes" : "No"}`);
    console.log(`   📅 Calendar ID: ${serviceWatch.calendarId}`);
    console.log(`   🔗 Webhook URL: ${serviceWatch.webhookUrl}`);

    if (isValid) {
      console.log("✅ Service calendar watch is active and valid");
    } else {
      console.log("⚠️ Service calendar watch is expired or expiring soon");
    }

    res.status(200).json({
      hasServiceWatch: true,
      isValid,
      serviceWatch: {
        channelId: serviceWatch.channelId,
        resourceId: serviceWatch.resourceId,
        expiration: serviceWatch.expiration,
        registeredAt: serviceWatch.registeredAt,
        hoursRemaining,
        calendarId: serviceWatch.calendarId,
        webhookUrl: serviceWatch.webhookUrl,
        watchType: serviceWatch.watchType || "service-calendar",
      },
      message: isValid
        ? `Service calendar watch is active (${hoursRemaining} hours remaining)`
        : `Service calendar watch needs renewal (expired ${Math.abs(
            hoursRemaining
          )} hours ago)`,
      recommendation: isValid
        ? "Service calendar watch is working properly"
        : "Register a new service calendar watch using /api/registerServiceCalendarWatch",
    });
  } catch (error) {
    console.error("❌ Error checking service calendar watch:", error);
    res.status(500).json({
      hasServiceWatch: false,
      error: error.message,
      message: "Error checking service calendar watch status",
    });
  }
}
