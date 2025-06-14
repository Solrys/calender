// Test the targeted webhook approach
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

async function testTargetedWebhook() {
    console.log('🎯 TESTING TARGETED WEBHOOK APPROACH');
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

        const now = Date.now();

        // Test 1: Old approach (24 hours)
        console.log('\n📊 OLD APPROACH: Fetching events from last 24 hours');
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

        const oldApproachRes = await calendar.events.list({
            calendarId,
            updatedMin: oneDayAgo.toISOString(),
            singleEvents: true,
            orderBy: "updated",
            maxResults: 25,
            timeZone: 'America/New_York'
        });

        const oldEvents = oldApproachRes.data.items || [];
        console.log(`   📅 Found ${oldEvents.length} events (24 hours)`);

        // Test 2: New approach (10 minutes)
        console.log('\n🎯 NEW APPROACH: Fetching events from last 10 minutes');
        const tenMinutesAgo = new Date(now - 10 * 60 * 1000);

        const newApproachRes = await calendar.events.list({
            calendarId,
            updatedMin: tenMinutesAgo.toISOString(),
            singleEvents: true,
            orderBy: "updated",
            maxResults: 5,
            timeZone: 'America/New_York'
        });

        const newEvents = newApproachRes.data.items || [];
        console.log(`   📅 Found ${newEvents.length} events (10 minutes)`);

        // Additional filtering
        const veryRecentEvents = newEvents.filter(event => {
            const eventUpdated = new Date(event.updated);
            const timeSinceUpdate = now - eventUpdated.getTime();
            return timeSinceUpdate < 15 * 60 * 1000; // Only events updated in last 15 minutes
        });

        console.log(`   📅 After filtering: ${veryRecentEvents.length} very recent events`);

        // Show comparison
        console.log('\n📊 COMPARISON:');
        console.log(`   Old approach: ${oldEvents.length} events (too many!)`);
        console.log(`   New approach: ${veryRecentEvents.length} events (targeted!)`);

        if (veryRecentEvents.length > 0) {
            console.log('\n📋 Very recent events that would be processed:');
            veryRecentEvents.forEach((event, index) => {
                const eventUpdated = new Date(event.updated);
                const eventCreated = new Date(event.created);
                const timeSinceUpdate = Math.round((now - eventUpdated.getTime()) / (60 * 1000));
                const timeSinceCreated = Math.round((now - eventCreated.getTime()) / (60 * 1000));

                console.log(`\n   ${index + 1}. ${event.summary || 'No title'}`);
                console.log(`      🆔 Event ID: ${event.id}`);
                console.log(`      📅 Start: ${event.start?.dateTime || 'No time'}`);
                console.log(`      🕐 Updated: ${timeSinceUpdate} minutes ago`);
                console.log(`      🕐 Created: ${timeSinceCreated} minutes ago`);
                console.log(`      🔑 Unique Key: ${event.id}_${event.updated}`);
            });
        } else {
            console.log('\n✅ No very recent events found - webhook would not process anything');
            console.log('💡 This is good! It means the webhook will only trigger for new events');
        }

        console.log('\n🎯 BENEFITS OF NEW APPROACH:');
        console.log('   ✅ Only processes events created/updated in last 10-15 minutes');
        console.log('   ✅ Reduces processing from potentially dozens to just a few events');
        console.log('   ✅ Prevents processing old events that already have bookings');
        console.log('   ✅ Uses unique identifiers to prevent duplicates');
        console.log('   ✅ Much faster and more efficient');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the test
console.log('🚀 Starting Targeted Webhook Test...\n');
testTargetedWebhook()
    .then(() => console.log('\n🏁 Test completed!'))
    .catch(console.error); 