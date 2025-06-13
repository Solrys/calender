// utils/createBookingFromCalendarEvent.js
import { formatInTimeZone } from "date-fns-tz";

// MIGRATION SAFETY SETTINGS - Must match calendar-sync.js and webhook
const MIGRATION_TIMESTAMP = new Date('2024-06-13T00:00:00Z');

// Helper: Convert a UTC Date to "h:mm a" in the given time zone
function convertTimeTo12Hour(date, timeZone = "America/Los_Angeles") {
  return formatInTimeZone(date, timeZone, "h:mm a");
}

// Parse customer name, email, phone from description
function parseEventDetails(description = "") {
  let customerName = "",
    customerEmail = "",
    customerPhone = "";
  description.split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
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

export async function createBookingFromCalendarEvent(event, calendarType = "Manual Booking Calendar") {
  // UPDATED: Use Pacific Time for LA client
  const timeZone = "America/Los_Angeles";

  // 1. Parse the UTC instants from the event
  const startUtc = new Date(event.start.dateTime || event.start.date);
  const endUtc = new Date(event.end.dateTime || event.end.date);

  // 2. Build the local date string in Pacific Time, e.g. "2025-03-26"
  const localDateString = formatInTimeZone(startUtc, timeZone, "yyyy-MM-dd");

  // 3. TIMEZONE FIX: Create timezone-neutral date (no midnight UTC conversion)
  // This prevents the 1-day shift issue for users in different timezones
  const [year, month, day] = localDateString.split("-").map(Number);

  // CRITICAL FIX: Create date in local timezone instead of UTC to prevent shifts
  // This ensures the date displays correctly for all users regardless of their timezone
  const startDate = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid daylight saving issues

  // 4. Format the times for display in Pacific Time
  const startTime = convertTimeTo12Hour(startUtc, timeZone);
  const endTime = convertTimeTo12Hour(endUtc, timeZone);

  // 5. Parse studio & customer details
  const studio = parseStudio(event.summary);
  const { customerName, customerEmail, customerPhone } = parseEventDetails(
    event.description
  );

  // 6. MIGRATION SAFETY: Determine payment status based on calendar type and event date
  let paymentStatus;
  if (startUtc >= MIGRATION_TIMESTAMP) {
    // NEW LOGIC: Only for events after migration timestamp
    if (calendarType === "Website Booking Calendar") {
      paymentStatus = "success"; // Website bookings are completed payments
    } else {
      paymentStatus = "manual"; // Manual calendar bookings are admin-created
    }
  } else {
    // LEGACY LOGIC: Keep existing behavior for old events
    paymentStatus = "manual"; // Default to manual for safety
  }

  // 7. Build your booking object
  return {
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
    customerName,
    customerEmail,
    customerPhone,
    event: false, // Default to false for manual bookings
    calendarEventId: event.id,
    createdAt: new Date(),
  };
}
