import { formatInTimeZone } from "date-fns-tz";

// …parseEventDetails, parseStudio, convertTimeTo12Hour as before…
// Helper: Convert a UTC Date to “h:mm a” in the given time zone
function convertTimeTo12Hour(date, timeZone = "America/New_York") {
  return formatInTimeZone(date, timeZone, "h:mm a");
}
export async function createBookingFromCalendarEvent(event) {
  const timeZone = "America/New_York";

  const startUtc = new Date(event.start.dateTime || event.start.date);
  const endUtc = new Date(event.end.dateTime || event.end.date);

  // 1) Get the local date string in ET
  const localDateString = formatInTimeZone(startUtc, timeZone, "yyyy-MM-dd");

  // 2) Manual ET-midnight → UTC conversion
  const [year, month, day] = localDateString.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  // 3) Format times for display
  const startTime = convertTimeTo12Hour(startUtc, timeZone);
  const endTime = convertTimeTo12Hour(endUtc, timeZone);

  // 4) Parse studio & customer details
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
