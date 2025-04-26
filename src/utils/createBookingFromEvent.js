// utils/createBookingFromCalendarEvent.js
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import Booking from "@/models/Booking";

// Parse details from the event description
function parseEventDetails(description = "") {
  let customerName = "";
  let customerEmail = "";
  let customerPhone = "";
  description.split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/customer name/i.test(key)) customerName = value;
    if (/customer email/i.test(key)) customerEmail = value;
    if (/customer phone/i.test(key)) customerPhone = value;
  });
  return { customerName, customerEmail, customerPhone };
}

// Extract studio name from the event summary
function parseStudio(summary = "") {
  const prefix = "Booking for ";
  return summary.startsWith(prefix)
    ? summary.slice(prefix.length).trim()
    : summary;
}

// Helper: Convert a Date object to a 12-hour format string in given TZ
function convertTimeTo12Hour(date, timeZone) {
  return formatInTimeZone(date, timeZone, "h:mm a");
}

/**
 * Build a booking object from a Google Calendar event,
 * storing the *local* date correctly for today vs. future dates.
 */
export async function createBookingFromCalendarEvent(event) {
  const timeZone = "America/New_York";

  // Parse the event's start and end as actual instants
  const startUtc = new Date(event.start.dateTime || event.start.date);
  const endUtc = new Date(event.end.dateTime || event.end.date);

  // 1️⃣ Extract the LOCAL date string in target TZ (e.g. "2025-03-26")
  const localDateString = formatInTimeZone(startUtc, timeZone, "yyyy-MM-dd");

  // 2️⃣ Convert that local date string at midnight back into a UTC Date
  //    so that when stored & re-fetched it stays the same calendar date.
  const startDate = zonedTimeToUtc(`${localDateString}T00:00:00`, timeZone);

  // 3️⃣ Convert the times for display
  const startTime = convertTimeTo12Hour(startUtc, timeZone);
  const endTime = convertTimeTo12Hour(endUtc, timeZone);

  // 4️⃣ Parse studio & customer details
  const studio = parseStudio(event.summary);
  const { customerName, customerEmail, customerPhone } = parseEventDetails(
    event.description
  );

  // 5️⃣ Build the booking record
  const bookingData = {
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

  return bookingData;
}
