// Test script to verify webhook output for July 30, 3:00-4:00 PM event
const { formatInTimeZone } = require("date-fns-tz");

// Copy the manual calendar event handler function here for testing
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

    const easternDateString = formatInTimeZone(eventStartTime, timeZone, "yyyy-MM-dd");
    console.log(`   📅 Eastern date string: ${easternDateString}`);

    const [year, month, day] = easternDateString.split("-").map(Number);
    const startDate = new Date(year, month - 1, day);

    const startTime = convertTimeTo12Hour(eventStartTime, timeZone);
    const endTime = convertTimeTo12Hour(eventEndTime, timeZone);

    console.log(`   🕐 Formatted start time: ${startTime}`);
    console.log(`   🕐 Formatted end time: ${endTime}`);

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

// Mock Google Calendar event for July 30, 3:00-4:00 PM Eastern Time
const mockGoogleCalendarEvent = {
    id: "test_event_july30_3pm",
    summary: "Booking for THE GROUND",
    description: `Customer Name: test
Customer Email: test@example.com
Customer Phone: 305-123-1111`,
    start: {
        dateTime: "2025-07-30T15:00:00-04:00", // 3:00 PM Eastern Time (EDT)
        timeZone: "America/New_York"
    },
    end: {
        dateTime: "2025-07-30T16:00:00-04:00", // 4:00 PM Eastern Time (EDT)
        timeZone: "America/New_York"
    }
};

async function testWebhookOutput() {
    console.log('🧪 TESTING WEBHOOK OUTPUT FOR JULY 30, 3:00-4:00 PM EVENT');
    console.log('='.repeat(60));

    console.log('\n📅 INPUT: Mock Google Calendar Event');
    console.log('Event Summary:', mockGoogleCalendarEvent.summary);
    console.log('Event Start:', mockGoogleCalendarEvent.start.dateTime);
    console.log('Event End:', mockGoogleCalendarEvent.end.dateTime);
    console.log('Event Timezone:', mockGoogleCalendarEvent.start.timeZone);

    console.log('\n🔧 PROCESSING WITH MANUAL CALENDAR HANDLER...');
    console.log('-'.repeat(50));

    try {
        const bookingData = await createBookingFromManualCalendarEvent(mockGoogleCalendarEvent, "Manual Booking Calendar");

        console.log('\n📊 OUTPUT: What will be stored in database');
        console.log('='.repeat(50));
        console.log('Studio:', bookingData.studio);
        console.log('Start Date:', bookingData.startDate.toISOString().split('T')[0]);
        console.log('Start Time:', bookingData.startTime);
        console.log('End Time:', bookingData.endTime);
        console.log('Customer Name:', bookingData.customerName);
        console.log('Customer Email:', bookingData.customerEmail);
        console.log('Customer Phone:', bookingData.customerPhone);
        console.log('Payment Status:', bookingData.paymentStatus);

        console.log('\n✅ EXPECTED DASHBOARD DISPLAY:');
        console.log('Date: July 30, 2025');
        console.log('Time: 3:00 PM - 4:00 PM');
        console.log('Customer: test');
        console.log('Studio: THE GROUND');

        const expectedDate = '2025-07-30';
        const expectedStartTime = '3:00 PM';
        const expectedEndTime = '4:00 PM';

        console.log('\n🎯 VERIFICATION:');
        console.log('Date matches July 30:', bookingData.startDate.toISOString().split('T')[0] === expectedDate ? '✅' : '❌');
        console.log('Start time is 3:00 PM:', bookingData.startTime === expectedStartTime ? '✅' : '❌');
        console.log('End time is 4:00 PM:', bookingData.endTime === expectedEndTime ? '✅' : '❌');
        console.log('Customer name is clean:', !bookingData.customerName.includes('<') ? '✅' : '❌');

        if (bookingData.startDate.toISOString().split('T')[0] === expectedDate &&
            bookingData.startTime === expectedStartTime &&
            bookingData.endTime === expectedEndTime) {
            console.log('\n🎉 SUCCESS: Timezone conversion is working correctly!');
        } else {
            console.log('\n❌ ISSUE: Timezone conversion needs fixing');
        }

    } catch (error) {
        console.error('❌ ERROR during processing:', error);
    }
}

// Run the test
console.log('🚀 Starting Webhook Output Test...\n');
testWebhookOutput()
    .then(() => console.log('\n🏁 Test completed!'))
    .catch(console.error); 