// Debug Google Calendar Timezone Script
// This script shows exactly what timezone info Google returns

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

// Initialize Google Calendar API
async function initializeGoogleCalendar() {
    try {
        let serviceAccountKey = env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountKey) {
            console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY not found');
            return null;
        }

        const serviceAccount = JSON.parse(serviceAccountKey);
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        const authClient = await auth.getClient();
        google.options({ auth: authClient });
        return google.calendar('v3');
    } catch (error) {
        console.error('❌ Failed to initialize Google Calendar API:', error);
        return null;
    }
}

// Debug specific event - Tatiana St Germain
async function debugTatianaEvent() {
    try {
        console.log('🔍 DEBUGGING TATIANA EVENT TIMEZONE');
        console.log('====================================');

        const calendar = await initializeGoogleCalendar();
        if (!calendar) return;

        // Get the specific event
        const eventId = 'ncnidv006iq5a5u25tvjs43n08';
        const calendarId = env.GOOGLE_CALENDAR_ID_WEBSITE;

        console.log(`📅 Fetching event: ${eventId}`);
        console.log(`📅 From calendar: ${calendarId}`);

        const response = await calendar.events.get({
            calendarId: calendarId,
            eventId: eventId
        });

        const event = response.data;

        console.log('\n📋 RAW EVENT DATA:');
        console.log('==================');
        console.log('Event Summary:', event.summary);
        console.log('Event ID:', event.id);

        console.log('\n⏰ START TIME INFO:');
        console.log('Raw start object:', JSON.stringify(event.start, null, 2));

        console.log('\n⏰ END TIME INFO:');
        console.log('Raw end object:', JSON.stringify(event.end, null, 2));

        // Parse the dateTime
        if (event.start.dateTime) {
            const startDate = new Date(event.start.dateTime);
            const endDate = new Date(event.end.dateTime);

            console.log('\n🕒 PARSED TIMES:');
            console.log('Start Date object:', startDate);
            console.log('End Date object:', endDate);
            console.log('Start ISO:', startDate.toISOString());
            console.log('End ISO:', endDate.toISOString());
            console.log('Start UTC string:', startDate.toUTCString());
            console.log('End UTC string:', endDate.toUTCString());
            console.log('Start local string:', startDate.toString());
            console.log('End local string:', endDate.toString());

            // Show different timezone interpretations
            console.log('\n🌍 TIMEZONE INTERPRETATIONS:');
            console.log('UTC Time:', startDate.toISOString().split('T')[1].slice(0, 5), '-', endDate.toISOString().split('T')[1].slice(0, 5));

            // Manual Pacific Time calculation (UTC-7 for PDT or UTC-8 for PST)
            const pacificOffset = -7; // PDT offset
            const startPacific = new Date(startDate.getTime() + (pacificOffset * 60 * 60 * 1000));
            const endPacific = new Date(endDate.getTime() + (pacificOffset * 60 * 60 * 1000));
            console.log('Pacific Time (manual):', startPacific.toISOString().split('T')[1].slice(0, 5), '-', endPacific.toISOString().split('T')[1].slice(0, 5));

            // Check timezone from event
            console.log('\n🌍 TIMEZONE FROM EVENT:');
            console.log('Start timezone:', event.start.timeZone || 'Not specified');
            console.log('End timezone:', event.end.timeZone || 'Not specified');
        }

        // Get calendar timezone
        console.log('\n📅 CALENDAR TIMEZONE INFO:');
        const calendarInfo = await calendar.calendars.get({
            calendarId: calendarId
        });
        console.log('Calendar timezone:', calendarInfo.data.timeZone);

    } catch (error) {
        console.error('❌ Error debugging event:', error);
    }
}

// Run the debug
debugTatianaEvent(); 