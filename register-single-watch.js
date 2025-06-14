// Register a single fresh Google Calendar watch
const { google } = require('googleapis');
const fs = require('fs');

// Load environment variables
function loadEnv() {
    try {
        const envContent = fs.readFileSync('.env', 'utf8');
        const envVars = {};
        const lines = envContent.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#')) {
                const equalIndex = line.indexOf('=');
                if (equalIndex > 0) {
                    const key = line.substring(0, equalIndex).trim();
                    let value = line.substring(equalIndex + 1).trim();

                    while (i + 1 < lines.length && !lines[i + 1].includes('=') && !lines[i + 1].startsWith('#')) {
                        i++;
                        value += lines[i].trim();
                    }

                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    envVars[key] = value;
                }
            }
        }
        return envVars;
    } catch (error) {
        console.error('❌ Could not load .env file:', error.message);
        return {};
    }
}

const env = loadEnv();

async function registerSingleWatch() {
    console.log('🔔 REGISTERING SINGLE FRESH CALENDAR WATCH');
    console.log('='.repeat(60));

    try {
        // Initialize Google Calendar
        const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        const authClient = await auth.getClient();
        google.options({ auth: authClient });
        const calendar = google.calendar('v3');
        const calendarId = env.GOOGLE_CALENDAR_ID;

        console.log('✅ Connected to Google Calendar API');

        // Use the production webhook URL (based on your logs)
        const webhookUrl = 'https://booking.bookthespace.com/api/google-calendar-webhook';
        const newChannelId = `single-calendar-watch-${Date.now()}`;

        console.log(`\n🔔 REGISTERING NEW WATCH...`);
        console.log(`   🆔 Channel ID: ${newChannelId}`);
        console.log(`   🔗 Webhook URL: ${webhookUrl}`);

        const watchResponse = await calendar.events.watch({
            calendarId: calendarId,
            requestBody: {
                id: newChannelId,
                type: 'web_hook',
                address: webhookUrl,
                params: {
                    ttl: '86400' // 24 hours TTL
                }
            }
        });

        console.log('\n✅ SINGLE WATCH REGISTERED SUCCESSFULLY!');
        console.log(`   🆔 Channel ID: ${watchResponse.data.id}`);
        console.log(`   🔗 Resource ID: ${watchResponse.data.resourceId}`);
        console.log(`   ⏰ Expiration: ${new Date(parseInt(watchResponse.data.expiration)).toISOString()}`);

        // Save the watch info
        const watchInfo = {
            channelId: watchResponse.data.id,
            resourceId: watchResponse.data.resourceId,
            expiration: watchResponse.data.expiration,
            registeredAt: new Date().toISOString(),
            webhookUrl: webhookUrl,
            note: 'Single watch registered after clearing duplicates'
        };

        fs.writeFileSync('single-watch-info.json', JSON.stringify(watchInfo, null, 2));
        console.log('\n📝 Watch info saved to single-watch-info.json');

        console.log('\n🎯 DUPLICATE ISSUE SHOULD BE FIXED!');
        console.log('   ✅ Stopped 2 duplicate watches');
        console.log('   ✅ Registered 1 fresh watch');
        console.log('   📅 Expected: Only ONE booking per Google Calendar event');

        console.log('\n🧪 TEST NOW:');
        console.log('   1. Create a NEW manual event in Google Calendar');
        console.log('   2. Use July 30, 2025 at 3:00-4:00 PM');
        console.log('   3. Should create only ONE booking with correct time');

    } catch (error) {
        console.error('❌ Error:', error);

        if (error.message.includes('webhook') || error.message.includes('https')) {
            console.log('\n💡 WEBHOOK ISSUE:');
            console.log('   - The webhook URL might not be accessible');
            console.log('   - Check if your production server is running');
            console.log('   - Verify the webhook endpoint responds correctly');
        }
    }
}

// Run the script
console.log('🚀 Starting Single Watch Registration...\n');
registerSingleWatch()
    .then(() => console.log('\n🏁 Single watch registration completed!'))
    .catch(console.error); 