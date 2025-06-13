// Check Google Calendar Events Script
// This script fetches events from Google Calendar and displays them clearly

const { google } = require('googleapis');
const { formatInTimeZone } = require('date-fns-tz');
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

// Parse customer details from event description
function parseEventDetails(description = "") {
    const details = {
        customerName: '',
        customerEmail: '',
        customerPhone: ''
    };

    if (!description) return details;

    const lines = description.split('\n');
    for (const line of lines) {
        if (line.startsWith('Customer Name:')) {
            details.customerName = line.split(':')[1]?.trim() || '';
        } else if (line.startsWith('Customer Email:')) {
            details.customerEmail = line.split(':')[1]?.trim() || '';
        } else if (line.startsWith('Customer Phone:')) {
            details.customerPhone = line.split(':')[1]?.trim() || '';
        }
    }

    return details;
}

// Fetch events from a specific calendar
async function fetchCalendarEvents(calendar, calendarId, calendarName) {
    try {
        console.log(`\n📅 Fetching events from ${calendarName}...`);

        // Get calendar timezone info
        const calendarInfo = await calendar.calendars.get({
            calendarId: calendarId
        });
        const calendarTimezone = calendarInfo.data.timeZone;
        console.log(`   Calendar timezone: ${calendarTimezone}`);

        // Get events from the last 3 months and next 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: threeMonthsAgo.toISOString(),
            timeMax: threeMonthsLater.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 50, // Limit to recent events
        });

        const events = response.data.items || [];
        console.log(`   Found ${events.length} events`);

        return events.map(event => ({
            ...event,
            calendarSource: calendarName,
            calendarTimezone: calendarTimezone
        }));

    } catch (error) {
        console.error(`❌ Error fetching events from ${calendarName}:`, error.message);
        return [];
    }
}

// Main function
async function checkCalendarEvents() {
    try {
        console.log('📅 GOOGLE CALENDAR EVENTS CHECKER');
        console.log('==================================');

        // Initialize Google Calendar
        const calendar = await initializeGoogleCalendar();
        if (!calendar) {
            console.error('❌ Failed to initialize Google Calendar API');
            return;
        }
        console.log('✅ Connected to Google Calendar API');

        // Get calendar IDs from environment
        const calendarConfigs = [
            { id: env.GOOGLE_CALENDAR_ID, name: 'Manual Booking Calendar' },
            { id: env.GOOGLE_CALENDAR_ID_WEBSITE, name: 'Website Booking Calendar' }
        ].filter(cal => cal.id);

        console.log(`\n📋 Checking ${calendarConfigs.length} calendar(s):`);
        calendarConfigs.forEach(cal => console.log(`   - ${cal.name}: ${cal.id}`));

        let totalEvents = 0;

        // Fetch and display events from each calendar
        for (const calendarConfig of calendarConfigs) {
            const events = await fetchCalendarEvents(calendar, calendarConfig.id, calendarConfig.name);
            totalEvents += events.length;

            if (events.length === 0) {
                console.log(`   No recent events found`);
                continue;
            }

            console.log(`\n📋 Events from ${calendarConfig.name}:`);
            console.log('='.repeat(80));

            events.forEach((event, index) => {
                // Skip all-day events
                if (!event.start.dateTime) {
                    return;
                }

                const startUtc = new Date(event.start.dateTime);
                const endUtc = new Date(event.end.dateTime);

                // Use the event's timezone if available, otherwise use calendar timezone
                const eventTimezone = event.start.timeZone || event.calendarTimezone;

                // Format in the calendar's actual timezone (same as Google Calendar UI)
                const dateStr = formatInTimeZone(startUtc, eventTimezone, "yyyy-MM-dd");
                const startTime = formatInTimeZone(startUtc, eventTimezone, "h:mm a");
                const endTime = formatInTimeZone(endUtc, eventTimezone, "h:mm a");

                // Parse customer details
                const customerDetails = parseEventDetails(event.description);

                console.log(`\n${index + 1}. ${event.summary || 'No title'}`);
                console.log(`   📅 Date: ${dateStr}`);
                console.log(`   ⏰ Time: ${startTime} - ${endTime} (${eventTimezone})`);
                console.log(`   👤 Customer: ${customerDetails.customerName || 'No name'}`);
                console.log(`   📧 Email: ${customerDetails.customerEmail || 'No email'}`);
                console.log(`   📱 Phone: ${customerDetails.customerPhone || 'No phone'}`);
                console.log(`   🆔 Event ID: ${event.id}`);

                // Show raw timezone info for debugging
                console.log(`   🌍 Raw timezone: ${event.start.timeZone || 'Not specified'}`);
            });
        }

        console.log(`\n📊 SUMMARY:`);
        console.log(`Total events checked: ${totalEvents}`);
        console.log(`\n✅ Calendar events displayed successfully!`);

    } catch (error) {
        console.error('❌ Error checking calendar events:', error);
    }
}

// Run the script
checkCalendarEvents(); 