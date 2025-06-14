import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import fs from 'fs';
import path from 'path';

// Clean up the service account key
let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (
  (serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) ||
  (serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'"))
) {
  serviceAccountKey = serviceAccountKey.slice(1, -1);
}
const serviceAccount = JSON.parse(serviceAccountKey);

// Path to store watch info
const WATCH_INFO_FILE = path.join(process.cwd(), 'current-watch-info.json');

// Function to read existing watch info
function getExistingWatchInfo() {
  try {
    if (fs.existsSync(WATCH_INFO_FILE)) {
      const watchData = fs.readFileSync(WATCH_INFO_FILE, 'utf8');
      return JSON.parse(watchData);
    }
  } catch (error) {
    console.log('⚠️ Could not read existing watch info:', error.message);
  }
  return null;
}

// Function to save watch info
function saveWatchInfo(watchInfo) {
  try {
    fs.writeFileSync(WATCH_INFO_FILE, JSON.stringify(watchInfo, null, 2));
    console.log('📝 Watch info saved successfully');
  } catch (error) {
    console.error('❌ Could not save watch info:', error.message);
  }
}

// Function to check if a watch is still valid
function isWatchValid(watchInfo) {
  if (!watchInfo || !watchInfo.expiration) {
    return false;
  }

  const now = Date.now();
  const expiration = parseInt(watchInfo.expiration);
  const timeUntilExpiration = expiration - now;

  // Consider valid if more than 1 hour remaining
  return timeUntilExpiration > 60 * 60 * 1000; // 1 hour in milliseconds
}

// Function to stop an existing watch
async function stopExistingWatch(calendar, watchInfo) {
  try {
    await calendar.channels.stop({
      requestBody: {
        id: watchInfo.channelId,
        resourceId: watchInfo.resourceId
      }
    });
    console.log(`✅ Stopped existing watch: ${watchInfo.channelId}`);
    return true;
  } catch (error) {
    console.log(`⚠️ Could not stop existing watch: ${error.message}`);
    return false;
  }
}

export default async function handler(req, res) {
  try {
    console.log('🔔 SMART CALENDAR WATCH REGISTRATION');
    console.log('='.repeat(50));

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({
      version: "v3",
      auth,
    });

    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const webhookUrl = process.env.CALENDAR_WEBHOOK_URL || `${process.env.NEXTAUTH_URL}/api/google-calendar-webhook`;

    console.log(`📅 Calendar ID: ${calendarId}`);
    console.log(`🔗 Webhook URL: ${webhookUrl}`);

    // Step 1: Check for existing watch
    const existingWatch = getExistingWatchInfo();

    if (existingWatch) {
      console.log(`\n🔍 Found existing watch: ${existingWatch.channelId}`);
      console.log(`   📅 Registered: ${existingWatch.registeredAt}`);
      console.log(`   ⏰ Expires: ${new Date(parseInt(existingWatch.expiration)).toISOString()}`);

      if (isWatchValid(existingWatch)) {
        const timeRemaining = Math.round((parseInt(existingWatch.expiration) - Date.now()) / (60 * 60 * 1000));
        console.log(`✅ Existing watch is still valid (${timeRemaining} hours remaining)`);
        console.log('🚫 No new watch needed - using existing one');

        return res.status(200).json({
          message: "Using existing valid watch",
          action: "no_action_needed",
          existingWatch: {
            channelId: existingWatch.channelId,
            resourceId: existingWatch.resourceId,
            expiration: existingWatch.expiration,
            hoursRemaining: timeRemaining
          }
        });
      } else {
        console.log('⚠️ Existing watch is expired or expiring soon');
        console.log('🛑 Stopping expired watch...');
        await stopExistingWatch(calendar, existingWatch);
      }
    } else {
      console.log('\n🔍 No existing watch found');
    }

    // Step 2: Register new watch
    console.log('\n🔔 Registering new calendar watch...');

    const channelId = `smart-calendar-watch-${Date.now()}`;
    console.log(`   🆔 New Channel ID: ${channelId}`);

    const channelConfig = {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      params: {
        ttl: '86400' // 24 hours TTL
      }
    };

    const response = await calendar.events.watch({
      calendarId,
      requestBody: channelConfig,
    });

    console.log("✅ New calendar watch registered successfully");
    console.log(`   🆔 Channel ID: ${response.data.id}`);
    console.log(`   🔗 Resource ID: ${response.data.resourceId}`);
    console.log(`   ⏰ Expiration: ${new Date(parseInt(response.data.expiration)).toISOString()}`);

    // Step 3: Save new watch info
    const newWatchInfo = {
      channelId: response.data.id,
      resourceId: response.data.resourceId,
      expiration: response.data.expiration,
      registeredAt: new Date().toISOString(),
      webhookUrl: webhookUrl,
      calendarId: calendarId,
      note: 'Smart watch - checks for duplicates before creating'
    };

    saveWatchInfo(newWatchInfo);

    console.log('\n🎯 SMART WATCH REGISTRATION COMPLETE');
    console.log('   ✅ Only one active watch at a time');
    console.log('   ✅ Automatic cleanup of expired watches');
    console.log('   ✅ Prevents duplicate webhook registrations');

    res.status(200).json({
      message: "Smart calendar watch registered successfully",
      action: "new_watch_created",
      calendarId,
      channelId: response.data.id,
      resourceId: response.data.resourceId,
      expiration: response.data.expiration,
      webhookUrl: webhookUrl,
      data: response.data
    });

  } catch (error) {
    console.error("❌ Error in smart calendar watch registration:", error);

    res.status(500).json({
      message: "Error in smart calendar watch registration",
      error: error.message,
    });
  }
}
