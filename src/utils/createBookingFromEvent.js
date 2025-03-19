// utils/createBookingFromEvent.js
import Booking from "@/models/Booking";
import { format } from "date-fns";

/**
 * Convert a Date object to a 12-hour formatted time string, e.g. "6:00 AM".
 */
function convertTimeTo12Hour(date) {
  return format(date, "h:mm a");
}

/**
 * Extract details from the event description.
 * Expects lines like:
 * "Customer Name: Sarah"
 * "Customer Email: woman@awomlab.com"
 * "Customer Phone: 3057981664"
 */
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

/**
 * Parse the studio name from the event summary.
 * Expects the summary to start with "Booking for "
 */
function parseStudio(summary = "") {
  const prefix = "Booking for ";
  if (summary.startsWith(prefix)) {
    return summary.slice(prefix.length).trim();
  }
  return summary;
}

/**
 * Create a Booking record in the database based on the event details.
 */
export async function createBookingFromCalendarEvent(event) {
  // Parse start and end times from the event.
  const startDateTime = event.start.dateTime
    ? new Date(event.start.dateTime)
    : new Date(event.start.date);
  const endDateTime = event.end.dateTime
    ? new Date(event.end.dateTime)
    : new Date(event.end.date);

  // Format date and time values.
  const startDate = startDateTime;
  const startTime = convertTimeTo12Hour(startDateTime);
  const endTime = convertTimeTo12Hour(endDateTime);

  // Extract studio from summary and customer details from description.
  const studio = parseStudio(event.summary);
  const { customerName, customerEmail, customerPhone } = parseEventDetails(
    event.description
  );

  // Set default values for items and cost if not provided manually.
  const items = [];
  const subtotal = 0;
  const studioCost = 0;
  const estimatedTotal = 0;
  const paymentStatus = "manual";

  const bookingData = {
    studio,
    startDate,
    startTime,
    endTime,
    items,
    subtotal,
    studioCost,
    estimatedTotal,
    paymentStatus,
    customerName,
    customerEmail,
    customerPhone,
    calendarEventId: event.id, // Save the event's unique ID for reference
    createdAt: new Date(),
  };

  // Create and save the booking document.
  const booking = new Booking(bookingData);
  await booking.save();
  return booking;
}
