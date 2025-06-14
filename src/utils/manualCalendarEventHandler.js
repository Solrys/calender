import { formatInTimeZone } from "date-fns-tz";

// MIGRATION SAFETY SETTINGS
const MIGRATION_TIMESTAMP = new Date('2024-06-13T00:00:00Z');
const SYNC_VERSION = 'v2.4-manual-calendar-fix';

// Helper: Convert a UTC Date to "h:mm a" in Eastern Time
function convertTimeTo12Hour(date, timeZone = "America/New_York") {
    return formatInTimeZone(date, timeZone, "h:mm a");
}

// Helper function to strip HTML tags and decode HTML entities
function cleanTextContent(text) {
    if (!text) return "";

    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // Decode common HTML entities
    text = text.replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

    return text.trim();
}

// Parse customer name, email, phone from description
function parseEventDetails(description = "") {
    let customerName = "",
        customerEmail = "",
        customerPhone = "";

    description.split("\n").forEach((line) => {
        const [key, ...rest] = line.split(":");
        const value = cleanTextContent(rest.join(":").trim());
        if (/customer name/i.test(key)) customerName = value;
        if (/customer email/i.test(key)) customerEmail = value;
        if (/customer phone/i.test(key)) customerPhone = value;
    });
    return { customerName, customerEmail, customerPhone };
}

// Extract the studio name from "Booking for XYZ"
function parseStudio(summary = "") {
    const prefix = "Booking for ";
    return summary.startsWith(prefix)
        ? summary.slice(prefix.length).trim()
        : summary;
}

// NEW FUNCTION: Specifically for manual calendar events with proper timezone handling
export async function createBookingFromManualCalendarEvent(event, calendarType = "Manual Booking Calendar") {
    console.log(`🔧 Processing manual calendar event with FIXED timezone handling`);
    console.log(`   📅 Original event start: ${event.start.dateTime}`);
    console.log(`   📅 Original event end: ${event.end?.dateTime}`);
    console.log(`   🌍 Event timezone: ${event.start.timeZone || 'Not specified'}`);

    // Use Eastern Time consistently
    const timeZone = "America/New_York";

    // Parse the event times - these are already in the correct timezone from Google Calendar
    const eventStartTime = new Date(event.start.dateTime);
    const eventEndTime = new Date(event.end?.dateTime || event.start.dateTime);

    console.log(`   🕐 Parsed start time (UTC): ${eventStartTime.toISOString()}`);
    console.log(`   🕐 Parsed end time (UTC): ${eventEndTime.toISOString()}`);

    // FIXED: Get the date in Eastern Time properly
    const easternDateString = formatInTimeZone(eventStartTime, timeZone, "yyyy-MM-dd");
    console.log(`   📅 Eastern date string: ${easternDateString}`);

    // FIXED: Create date object properly to avoid timezone shifts
    // Instead of new Date(year, month-1, day) which uses local timezone,
    // create a UTC date and then adjust to ensure it represents the correct date
    const startDate = new Date(easternDateString + 'T12:00:00.000Z');

    // FIXED: Format the times correctly in Eastern Time
    const startTime = convertTimeTo12Hour(eventStartTime, timeZone);
    const endTime = convertTimeTo12Hour(eventEndTime, timeZone);

    console.log(`   🕐 Formatted start time: ${startTime}`);
    console.log(`   🕐 Formatted end time: ${endTime}`);
    console.log(`   📅 Final start date: ${startDate.toISOString().split('T')[0]}`);

    // Parse studio & customer details
    const studio = parseStudio(event.summary);
    const { customerName, customerEmail, customerPhone } = parseEventDetails(
        event.description
    );

    console.log(`   👤 Customer: ${customerName}`);
    console.log(`   🏢 Studio: ${studio}`);

    // Determine payment status
    let paymentStatus;
    if (eventStartTime >= MIGRATION_TIMESTAMP) {
        if (calendarType === "Website Booking Calendar") {
            paymentStatus = "success";
        } else {
            paymentStatus = "manual";
        }
    } else {
        paymentStatus = "manual";
    }

    // Build the booking object with FIXED timezone data
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
        customerName: cleanTextContent(customerName), // Clean HTML immediately
        customerEmail: cleanTextContent(customerEmail),
        customerPhone: cleanTextContent(customerPhone),
        event: false,
        calendarEventId: event.id,
        createdAt: new Date(),
        syncVersion: SYNC_VERSION,
        // Add debug info
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