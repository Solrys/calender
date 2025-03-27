import Booking from "@/models/Booking";
import { formatInTimeZone, utcToZonedTime } from "date-fns-tz";

// Convert a Date object to a 12-hour format string in the specified time zone
function convertTimeTo12Hour(date, timeZone = "America/New_York") {
  return formatInTimeZone(date, timeZone, "h:mm a");
}

// Parse customer details from the event description
function parseEventDetails(description = "") {
  let customerName = "";
  let customerEmail = "";
  let customerPhone = "";
  const lines = description.split("\n");
  lines.forEach((line) => {
    const lower = line.toLowerCase();
    if (lower.includes("customer name:")) {
      customerName = line.split(":")[1]?.trim() || "";
    }
    if (lower.includes("customer email:")) {
      customerEmail = line.split(":")[1]?.trim() || "";
    }
    if (lower.includes("customer phone:")) {
      customerPhone = line.split(":")[1]?.trim() || "";
    }
  });
  return { customerName, customerEmail, customerPhone };
}

// Extract studio name from the event summary
function parseStudio(summary = "") {
  const prefix = "Booking for ";
  if (summary.startsWith(prefix)) {
    return summary.slice(prefix.length).trim();
  }
  return summary;
}

// Build the booking data from a Google Calendar event
export async function createBookingFromCalendarEvent(event) {
  console.log(event, "creating event from calendar");

  const timeZone = "America/New_York";

  // Parse the event start/end times from Google Calendar (in UTC)
  const startUtc = new Date(event.start.dateTime || event.start.date);
  const endUtc = new Date(event.end.dateTime || event.end.date);

  // Convert to Eastern for storage or display as needed
  const startDate = utcToZonedTime(startUtc, timeZone);
  const startTime = convertTimeTo12Hour(startUtc, timeZone);
  const endTime = convertTimeTo12Hour(endUtc, timeZone);

  const studio = parseStudio(event.summary);
  const { customerName, customerEmail, customerPhone } = parseEventDetails(
    event.description
  );

  // Build a plain object with the booking data
  const bookingData = {
    studio,
    startDate, // stored as Date (Eastern time version)
    startTime, // formatted as a string in 12-hour format
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

  // Instead of saving here directly, we return the plain data object so that
  // it can be used in an upsert operation.
  return bookingData;
}
