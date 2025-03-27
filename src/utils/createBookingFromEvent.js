import Booking from "@/models/Booking";
import { formatInTimeZone, utcToZonedTime } from "date-fns-tz";

// Convert a Date object to 12-hour format string in the specified time zone
function convertTimeTo12Hour(date, timeZone = "America/New_York") {
  return formatInTimeZone(date, timeZone, "h:mm a");
}

// Parse details from the event description
function parseEventDetails(description = "") {
  let customerName = "";
  let customerEmail = "";
  let customerPhone = "";
  const lines = description.split("\n");
  lines.forEach((line) => {
    if (line.toLowerCase().includes("customer name:")) {
      customerName = line.split(":")[1]?.trim() || "";
    }
    if (line.toLowerCase().includes("customer email:")) {
      customerEmail = line.split(":")[1]?.trim() || "";
    }
    if (line.toLowerCase().includes("customer phone:")) {
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

// Create booking data from a calendar event (without saving)
export async function createBookingFromCalendarEvent(event) {
  console.log(event, "creating event from calendar");

  const timeZone = "America/New_York";

  const startUtc = new Date(event.start.dateTime || event.start.date);
  const endUtc = new Date(event.end.dateTime || event.end.date);

  // Convert times to Eastern time zone
  const startDate = utcToZonedTime(startUtc, timeZone);
  const startTime = convertTimeTo12Hour(startUtc, timeZone);
  const endTime = convertTimeTo12Hour(endUtc, timeZone);

  const studio = parseStudio(event.summary);
  const { customerName, customerEmail, customerPhone } = parseEventDetails(
    event.description
  );

  // Build the booking data object
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

  // Instead of saving here, return the booking data.
  return bookingData;
}
