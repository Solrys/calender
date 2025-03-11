import {
  format,
  addDays,
  startOfDay,
  differenceInCalendarDays,
} from "date-fns";

// Build a range of half-hour slots (as objects with date and time) between start and end.
export function getTimeSlotsRange(startDate, startTime, endDate, endTime) {
  const slotsRange = [];
  const dailySlots = generateDailySlots();
  const dayCount = differenceInCalendarDays(endDate, startDate);
  for (let offset = 0; offset <= dayCount; offset++) {
    const currentDay = addDays(startDate, offset);
    const dateKey = format(currentDay, "yyyy-MM-dd");
    const isFirstDay = offset === 0;
    const isLastDay = offset === dayCount;
    const startMins = isFirstDay
      ? timeStringToMinutes(startTime)
      : timeStringToMinutes("8:00 AM");
    const endMins = isLastDay
      ? timeStringToMinutes(endTime)
      : timeStringToMinutes("21:00");
    dailySlots.forEach((slot) => {
      const slotMins = timeStringToMinutes(slot);
      if (slotMins >= startMins && slotMins < endMins) {
        slotsRange.push({ date: dateKey, time: slot });
      }
    });
  }
  return slotsRange;
}

export function timeStringToMinutes(timeStr) {
  if (timeStr === "---:--") return Infinity;
  const [time, period] = timeStr.split(" ");
  const [hourStr, minuteStr] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const minutes = parseInt(minuteStr, 10);
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return hour * 60 + minutes;
}

export function minutesToTimeString(totalMinutes) {
  // For example, 480 -> "8:00 AM"
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const isAm = hours24 < 12;
  let displayHour = hours24 % 12;
  if (displayHour === 0) displayHour = 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  const ampm = isAm ? "AM" : "PM";
  return `${displayHour}:${displayMinutes} ${ampm}`;
}
export function generateDailySlots() {
  const slots = [];
  for (let hour = 8; hour <= 21; hour++) {
    const period = hour < 12 ? "AM" : "PM";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    slots.push(`${h12}:00 ${period}`);
    if (hour < 21) {
      slots.push(`${h12}:30 ${period}`);
    }
  }
  return slots;
}

// Compute blocked times keyed by date.
export function computeBlockedTimesByDate(bookings) {
  const blocked = {};
  bookings.forEach((booking) => {
    // Use startDate as the key (assuming bookings only have one date)
    const dateKey = format(new Date(booking.startDate), "yyyy-MM-dd");
    if (!blocked[dateKey]) {
      blocked[dateKey] = new Set();
    }
    const start = timeStringToMinutes(booking.startTime);
    const end = timeStringToMinutes(booking.endTime);
    // Add each 30-minute slot between start and end.
    for (let t = start; t < end; t += 30) {
      blocked[dateKey].add(t);
    }
  });
  return blocked;
}
