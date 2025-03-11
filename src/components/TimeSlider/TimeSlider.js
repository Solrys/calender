import React, { useState, useEffect, useRef, useMemo } from "react";
import { isToday } from "date-fns";

// Generate an array of times in 1-hour increments from 6:00 AM to 11:00 PM.
function generateTimes() {
  const times = [];
  for (let hour = 6; hour <= 23; hour++) {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const period = hour < 12 ? "AM" : "PM";
    times.push(`${h12}:00 ${period}`);
  }
  return times;
}

const ALL_TIMES = generateTimes();

// Convert a time string like "11:00 AM" to minutes after midnight.
function timeStringToMinutes(timeStr) {
  const [time, period] = timeStr.split(" ");
  const [hourStr, minuteStr] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const minutes = parseInt(minuteStr, 10);
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return hour * 60 + minutes;
}

/**
 * TimeSlider Component
 */
export default function TimeSlider({
  title,
  value,
  onChange,
  selectedDate,
  blockedTimes = new Set(),
  isMobile,
  bookingHours = 0, // booking hours required for continuous availability
}) {
  // Compute the available times based on the bookingHours requirement.
  const availableTimes = useMemo(() => {
    if (!bookingHours || bookingHours <= 0) return ALL_TIMES;

    return ALL_TIMES.filter((slot) => {
      const slotMins = timeStringToMinutes(slot);
      // Ensure the entire block fits before 11:00 PM
      if (slotMins + bookingHours * 60 > 23 * 60) return false;

      // Check each hour in the block to ensure it's not blocked.
      for (let i = 0; i < bookingHours; i++) {
        const checkTime = slotMins + i * 60;
        if (blockedTimes.has(checkTime)) return false;
      }
      return true;
    });
  }, [bookingHours, blockedTimes]);

  // Keep track of selected index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Scroll container reference
  const containerRef = useRef(null);

  // Reset selected time if the previous selection is no longer available
  useEffect(() => {
    if (availableTimes.length > 0) {
      // Ensure the selected time is within the available options
      if (!availableTimes.includes(value)) {
        setCurrentIndex(0);
        onChange(availableTimes[0]); // Auto-select the first available slot
      }
    } else {
      onChange(""); // No available slots
    }
  }, [availableTimes, onChange]);

  // Scroll to the selected time slot when currentIndex changes
  useEffect(() => {
    if (!isMobile && containerRef.current) {
      const slotElement = containerRef.current.querySelector(
        `[data-index="${currentIndex}"]`
      );
      if (slotElement) {
        slotElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [currentIndex, isMobile]);

  // If no slots are available, show a message.
  if (availableTimes.length === 0) {
    return (
      <div className="text-red-500 font-bold">
        No available slots for the selected duration
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center mt-1">
      <div ref={containerRef} className="w-full p-2 sm:h-[500px] overflow-auto">
        {availableTimes.map((slot, i) => {
          const isSelected = i === currentIndex;
          const slotClass = isSelected
            ? "border border-blue-500 bg-white"
            : "bg-white text-black cursor-pointer hover:bg-blue-50";
          return (
            <div
              key={slot}
              data-index={i}
              onClick={() => {
                setCurrentIndex(i);
                onChange(slot);
              }}
              className={`mb-2 p-2 rounded text-center ${slotClass}`}
            >
              {slot}
            </div>
          );
        })}
      </div>
    </div>
  );
}
