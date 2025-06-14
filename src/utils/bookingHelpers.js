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
    // TIMEZONE-NEUTRAL FIX: Extract date directly from ISO string to avoid timezone conversion
    const isoDate = new Date(booking.startDate).toISOString();
    const datePart = isoDate.split('T')[0]; // Gets "2025-07-19"

    // SAFER LOGIC: Only bookings with the SPECIFIC new sync version are already correct
    // This prevents affecting existing manual bookings that might be working correctly
    const isNewFixedBooking = booking.syncVersion === 'v2.5-date-timezone-fixed';

    // Only add +1 day for bookings that haven't been corrected yet
    // BUT NOT for bookings created with the new timezone-fixed handler
    const needsCorrection = !isNewFixedBooking &&
      (!booking.syncVersion ||
        !booking.syncVersion.includes('v3.1-date-corrected'));

    let dateKey;
    if (needsCorrection) {
      // Apply +1 day correction to match the display logic
      const [year, month, day] = datePart.split('-');
      const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
      correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
      dateKey = correctedDate.toISOString().split('T')[0];
    } else {
      // For new fixed bookings, use the date as-is
      dateKey = datePart;
    }

    if (!blocked[dateKey]) {
      blocked[dateKey] = new Set();
    }

    // Convert booking times to minute values and add to blocked set
    const start = timeStringToMinutes(booking.startTime);
    const end = timeStringToMinutes(booking.endTime);

    // Add each 30-minute slot from the booking start until (end + 30 minutes)
    for (let t = start - 30; t < end + 30; t += 30) {
      blocked[dateKey].add(t);
    }
  });
  return blocked;
}
