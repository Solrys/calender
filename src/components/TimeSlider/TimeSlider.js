import React, { useState, useEffect, useRef, useMemo } from "react";
import { isToday } from "date-fns";

// Generate an array of times in 30-minute increments from 6:00 AM to 11:30 PM.
function generateTimes() {
  const times = [];
  for (let hour = 6; hour < 24; hour++) {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const period = hour < 12 ? "AM" : "PM";
    times.push(`${h12}:00 ${period}`);
    times.push(`${h12}:30 ${period}`);
  }
  return times;
}

const ALL_TIMES = generateTimes();

// Convert a time string like "11:00 AM" or "11:30 AM" to minutes after midnight.
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
 * TimeSlider Component with a 30-minute buffer between bookings.
 */
export default function TimeSlider({
  title,
  value,
  onChange,
  selectedDate,
  blockedTimes = new Set(),
  isMobile,
  handleNext,
  bookingHours = 0, // booking hours required for continuous availability
}) {
  // Compute the available times based on bookingHours.
  // If bookingHours > 0, filter out slots that can't accommodate the entire block.
  const availableTimes = useMemo(() => {
    let times = ALL_TIMES;
    if (bookingHours > 0) {
      times = ALL_TIMES.filter((slot) => {
        const slotMins = timeStringToMinutes(slot);
        // Ensure the entire block fits before midnight (24:00)
        if (slotMins + bookingHours * 60 > 24 * 60) return false;
        // Since our times are in 30-minute increments, check every 30-minute step.
        for (let i = 0; i < bookingHours * 2; i++) {
          const checkTime = slotMins + i * 30;
          if (blockedTimes.has(checkTime)) return false;
        }
        return true;
      });
    }
    // For today, filter out times that have already passed.
    if (selectedDate && isToday(selectedDate)) {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      times = times.filter((slot) => timeStringToMinutes(slot) >= currentMins);
    }
    return times;
  }, [bookingHours, blockedTimes, selectedDate]);

  // Track selected index.
  const [currentIndex, setCurrentIndex] = useState(0);

  // Scroll container reference.
  const containerRef = useRef(null);

  // Reset selected time if the current one is no longer available.
  useEffect(() => {
    if (availableTimes.length > 0) {
      if (!availableTimes.includes(value)) {
        setCurrentIndex(0);
        onChange(availableTimes[0]); // Auto-select first available slot.
      }
    } else {
      onChange("");
    }
  }, [availableTimes, onChange, value]);

  // Scroll into view when currentIndex changes (desktop only).
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

  if (availableTimes.length === 0) {
    return (
      <div className="text-red-500 font-bold">
        No available slots for the selected duration
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center mt-1">
      <div ref={containerRef} className="w-full p-2 sm:h-[400px] overflow-auto">
        {availableTimes.map((slot, i) => {
          const isSelected = i === currentIndex;
          const slotClass = isSelected
            ? "border border-[#000] bg-white"
            : "bg-white text-black cursor-pointer border border-[#00000020] hover:bg-blue-50";
          return (
            <div
              key={slot}
              className={`grid ${
                isSelected ? "grid-cols-2" : "grid-cols-1"
              } gap-4`}
            >
              <div
                data-index={i}
                onClick={() => {
                  setCurrentIndex(i);
                  onChange(slot);
                }}
                className={`mb-2 p-2 rounded text-center ${slotClass}`}
              >
                {slot}
              </div>
              {isSelected && (
                <button
                  className="p-2 rounded text-white bg-[#000] h-10 border-0"
                  onClick={handleNext}
                >
                  Next
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
