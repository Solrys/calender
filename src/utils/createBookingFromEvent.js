// utils/createBookingFromCalendarEvent.js
import { formatInTimeZone } from "date-fns-tz";

// Helper: Convert a UTC Date to “h:mm a” in the given time zone
function convertTimeTo12Hour(date, timeZone = "America/New_York") {
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

export async function createBookingFromCalendarEvent(event) {
  const timeZone = "America/New_York";

  // 1. Parse the UTC instants from the event
  const startUtc = new Date(event.start.dateTime || event.start.date);
  const endUtc = new Date(event.end.dateTime || event.end.date);

  // 2. Build the local date string in ET, e.g. "2025-03-26"
  const localDateString = formatInTimeZone(startUtc, timeZone, "yyyy-MM-dd");

  // 3. Convert that local date at midnight back into a UTC Date:
  const [year, month, day] = localDateString.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  // 4. Format the times for display
  const startTime = convertTimeTo12Hour(startUtc, timeZone);
  const endTime = convertTimeTo12Hour(endUtc, timeZone);

  // 5. Parse studio & customer details
  const studio = parseStudio(event.summary);
  const { customerName, customerEmail, customerPhone } = parseEventDetails(
    event.description
  );

  // 6. Build your booking object
  return {
    studio,
    startDate,
    startTime,
    endTime,
    items: [],
    subtotal: 0,
    studioCost: 0,
    estimatedTotal: 0,
    paymentStatus: "manual",
    customerName,
    customerEmail,
    customerPhone,
    calendarEventId: event.id,
    createdAt: new Date(),
  };
}
