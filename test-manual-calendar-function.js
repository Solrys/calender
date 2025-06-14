// Test Manual Calendar Function with Real Google Calendar Events
// This script fetches real manual events and tests the function output

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

// Copy the manual calendar event handler function for testing
const MIGRATION_TIMESTAMP = new Date('2024-06-13T00:00:00Z');
const SYNC_VERSION = 'v2.4-manual-calendar-fix';

function convertTimeTo12Hour(date, timeZone = "America/New_York") {
    return formatInTimeZone(date, timeZone, "h:mm a");
}

function cleanTextContent(text) {
    if (!text) return "";
    text = text.replace(/<[^>]*>/g, '');
    text = text.replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
    return text.trim();
}

function parseEventDetails(description = "") {
    let customerName = "", customerEmail = "", customerPhone = "";
    description.split("\n").forEach((line) => {
        const [key, ...rest] = line.split(":");
        const value = cleanTextContent(rest.join(":").trim());
        if (/customer name/i.test(key)) customerName = value;
        if (/customer email/i.test(key)) customerEmail = value;
        if (/customer phone/i.test(key)) customerPhone = value;
    });
    return { customerName, customerEmail, customerPhone };
}

function parseStudio(summary = "") {
    const prefix = "Booking for ";
    return summary.startsWith(prefix) ? summary.slice(prefix.length).trim() : summary;
}

// FIXED Manual Calendar Event Handler Function
async function createBookingFromManualCalendarEvent(event, calendarType = "Manual Booking Calendar") {
    console.log(`🔧 Processing manual calendar event with FIXED timezone handling`);
    console.log(`   📅 Original event start: ${event.start.dateTime}`);
    console.log(`   📅 Original event end: ${event.end?.dateTime}`);
    console.log(`   🌍 Event timezone: ${event.start.timeZone || 'Not specified'}`);

    const timeZone = "America/New_York";
    const eventStartTime = new Date(event.start.dateTime);
    const eventEndTime = new Date(event.end?.dateTime || event.start.dateTime);

    console.log(`   🕐 Parsed start time (UTC): ${eventStartTime.toISOString()}`);
    console.log(`   🕐 Parsed end time (UTC): ${eventEndTime.toISOString()}`);

    // FIXED: Get the date in Eastern Time properly
    const easternDateString = formatInTimeZone(eventStartTime, timeZone, "yyyy-MM-dd");
    console.log(`   📅 Eastern date string: ${easternDateString}`);

    // FIXED: Create date object properly to avoid timezone shifts
    const startDate = new Date(easternDateString + 'T12:00:00.000Z');

    const startTime = convertTimeTo12Hour(eventStartTime, timeZone);
    const endTime = convertTimeTo12Hour(eventEndTime, timeZone);

    console.log(`   🕐 Formatted start time: ${startTime}`);
    console.log(`   🕐 Formatted end time: ${endTime}`);
    console.log(`   📅 Final start date: ${startDate.toISOString().split('T')[0]}`);

    const studio = parseStudio(event.summary);
    const { customerName, customerEmail, customerPhone } = parseEventDetails(event.description);

    console.log(`   👤 Customer: ${customerName}`);
    console.log(`   🏢 Studio: ${studio}`);

    let paymentStatus;
    if (eventStartTime >= MIGRATION_TIMESTAMP) {
        paymentStatus = calendarType === "Website Booking Calendar" ? "success" : "manual";
    } else {
        paymentStatus = "manual";
    }

    const bookingData = {
        studio,
        startDate,
        startTime,
        endTime,
        items: [],
        subtotal: 0,
        studioCost: 0,
        cleaningFee: 0,
        estimatedTotal: 0,
        paymentStatus,
        customerName: cleanTextContent(customerName),
        customerEmail: cleanTextContent(customerEmail),
        customerPhone: cleanTextContent(customerPhone),
        event: false,
        calendarEventId: event.id,
        createdAt: new Date(),
        syncVersion: SYNC_VERSION,
        originalEventStart: event.start.dateTime,
        originalEventEnd: event.end?.dateTime,
        eventTimeZone: event.start.timeZone,
        processedWithManualHandler: true
    };

    console.log(`   ✅ Final booking data:`, {
        studio: bookingData.studio,
        startDate: bookingData.startDate.toISOString().split('T')[0],
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        customerName: bookingData.customerName
    });

    return bookingData;
}

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

// Fetch recent manual events from Google Calendar
async function fetchManualEvents(calendar) {
    try {
        console.log('📅 Fetching recent manual events from Google Calendar...');

        const calendarId = env.GOOGLE_CALENDAR_ID; // Manual Booking Calendar
        if (!calendarId) {
            console.error('❌ GOOGLE_CALENDAR_ID not found in environment');
            return [];
        }

        // Get events from the last 30 days and next 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: thirtyDaysAgo.toISOString(),
            timeMax: thirtyDaysLater.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 10, // Limit to recent events for testing
        });

        const events = response.data.items || [];
        console.log(`✅ Found ${events.length} events in Manual Booking Calendar`);

        // Filter out all-day events and events without proper time
        const timedEvents = events.filter(event => event.start?.dateTime);
        console.log(`📋 ${timedEvents.length} events have specific times (not all-day)`);

        return timedEvents;

    } catch (error) {
        console.error('❌ Error fetching manual events:', error.message);
        return [];
    }
}

// Test function output against expected values
function validateBookingOutput(event, bookingData) {
    console.log('\n🎯 VALIDATION RESULTS:');
    console.log('='.repeat(50));

    // Get the original event date/time in Eastern Time for comparison
    const eventStartTime = new Date(event.start.dateTime);
    const eventEndTime = new Date(event.end.dateTime);
    const timeZone = "America/New_York";

    const expectedDate = formatInTimeZone(eventStartTime, timeZone, "yyyy-MM-dd");
    const expectedStartTime = formatInTimeZone(eventStartTime, timeZone, "h:mm a");
    const expectedEndTime = formatInTimeZone(eventEndTime, timeZone, "h:mm a");

    console.log('Expected vs Actual:');
    console.log(`📅 Date: ${expectedDate} vs ${bookingData.startDate.toISOString().split('T')[0]} ${expectedDate === bookingData.startDate.toISOString().split('T')[0] ? '✅' : '❌'}`);
    console.log(`🕐 Start: ${expectedStartTime} vs ${bookingData.startTime} ${expectedStartTime === bookingData.startTime ? '✅' : '❌'}`);
    console.log(`🕐 End: ${expectedEndTime} vs ${bookingData.endTime} ${expectedEndTime === bookingData.endTime ? '✅' : '❌'}`);
    console.log(`👤 Customer: ${bookingData.customerName} ${!bookingData.customerName.includes('<') ? '✅ (Clean)' : '❌ (Has HTML)'}`);
    console.log(`🏢 Studio: ${bookingData.studio}`);
    console.log(`💳 Payment: ${bookingData.paymentStatus}`);

    const isCorrect = (
        expectedDate === bookingData.startDate.toISOString().split('T')[0] &&
        expectedStartTime === bookingData.startTime &&
        expectedEndTime === bookingData.endTime &&
        !bookingData.customerName.includes('<')
    );

    return isCorrect;
}

// Main test function
async function testManualCalendarFunction() {
    console.log('🧪 TESTING MANUAL CALENDAR FUNCTION WITH REAL EVENTS');
    console.log('='.repeat(60));

    try {
        // Initialize Google Calendar
        const calendar = await initializeGoogleCalendar();
        if (!calendar) {
            console.error('❌ Failed to initialize Google Calendar API');
            return;
        }
        console.log('✅ Connected to Google Calendar API');

        // Fetch real manual events
        const events = await fetchManualEvents(calendar);
        if (events.length === 0) {
            console.log('⚠️ No manual events found to test');
            console.log('💡 Create a manual event in Google Calendar and run this test again');
            return;
        }

        let passedTests = 0;
        let totalTests = 0;

        // Test each event
        for (let i = 0; i < Math.min(events.length, 5); i++) { // Test up to 5 events
            const event = events[i];
            totalTests++;

            console.log(`\n${'='.repeat(80)}`);
            console.log(`🧪 TEST ${i + 1}: ${event.summary || 'Untitled Event'}`);
            console.log(`${'='.repeat(80)}`);

            console.log('\n📅 ORIGINAL GOOGLE CALENDAR EVENT:');
            console.log(`   Summary: ${event.summary}`);
            console.log(`   Start: ${event.start.dateTime}`);
            console.log(`   End: ${event.end.dateTime}`);
            console.log(`   Timezone: ${event.start.timeZone || 'Not specified'}`);
            console.log(`   Event ID: ${event.id}`);

            try {
                // Test the function
                const bookingData = await createBookingFromManualCalendarEvent(event, "Manual Booking Calendar");

                // Validate the output
                const isCorrect = validateBookingOutput(event, bookingData);

                if (isCorrect) {
                    console.log('\n🎉 TEST PASSED: Function output is correct!');
                    passedTests++;
                } else {
                    console.log('\n❌ TEST FAILED: Function output has issues');
                }

                console.log('\n📊 WHAT WILL BE STORED IN DATABASE:');
                console.log(`   Studio: ${bookingData.studio}`);
                console.log(`   Date: ${bookingData.startDate.toISOString().split('T')[0]}`);
                console.log(`   Time: ${bookingData.startTime} - ${bookingData.endTime}`);
                console.log(`   Customer: ${bookingData.customerName}`);
                console.log(`   Email: ${bookingData.customerEmail}`);
                console.log(`   Phone: ${bookingData.customerPhone}`);
                console.log(`   Payment Status: ${bookingData.paymentStatus}`);

            } catch (error) {
                console.error(`❌ Error testing event ${i + 1}:`, error.message);
            }
        }

        // Final summary
        console.log(`\n${'='.repeat(80)}`);
        console.log('📊 FINAL TEST RESULTS');
        console.log(`${'='.repeat(80)}`);
        console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
        console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests} tests`);

        if (passedTests === totalTests) {
            console.log('\n🎉 ALL TESTS PASSED! Your manual calendar function is working correctly.');
            console.log('✅ Manual Google Calendar events will be stored accurately in the database.');
        } else {
            console.log('\n⚠️ Some tests failed. The function may need additional fixes.');
        }

    } catch (error) {
        console.error('❌ Error running tests:', error);
    }
}

// Run the test
console.log('🚀 Starting Manual Calendar Function Test...\n');
testManualCalendarFunction()
    .then(() => console.log('\n🏁 Test completed!'))
    .catch(console.error); 