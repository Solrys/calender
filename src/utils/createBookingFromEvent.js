import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";

// …parseEventDetails, parseStudio, convertTimeTo12Hour as before…

export async function createBookingFromCalendarEvent(event) {
  const timeZone = "America/New_York";

  const startUtc = new Date(event.start.dateTime || event.start.date);
  const endUtc = new Date(event.end.dateTime || event.end.date);

  // 1) Get the local date string in ET
  const localDateString = formatInTimeZone(startUtc, timeZone, "yyyy-MM-dd");

  // 2) Turn that “2025-03-26” at midnight ET into the correct UTC Date
  const startDate = zonedTimeToUtc(`${localDateString}T00:00:00`, timeZone);

  const startTime = convertTimeTo12Hour(startUtc, timeZone);
  const endTime = convertTimeTo12Hour(endUtc, timeZone);

  const studio = parseStudio(event.summary);
  const { customerName, customerEmail, customerPhone } = parseEventDetails(
    event.description
  );

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
