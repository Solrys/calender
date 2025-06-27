import React, { useContext, useState, useEffect, useMemo } from "react";
import { format, startOfDay, addDays, isToday } from "date-fns";
// shadcn/ui components
import { Calendar } from "@/components/ui/calendar";
import styles from "@/styles/Home.module.css";
import { BookingContext } from "@/context/BookingContext";
import { useRouter } from "next/router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
// Import helper for time conversions
import {
  minutesToTimeString,
  timeStringToMinutes,
} from "@/utils/bookingHelpers";

// Import TimeSlider
import TimeSlider from "@/components/TimeSlider/TimeSlider";

export default function ServiceBooking() {
  const {
    startDate,
    setStartDate,
    startTime,
    setStartTime,
    setEndTime,
    endTime,
  } = useContext(BookingContext);
  const today = startOfDay(new Date());
  const router = useRouter();

  const [errors, setErrors] = useState({
    startDate: false,
    startTime: false,
  });

  // Local state for booking hours. Default is 0 (i.e. not selected).
  const [bookingHours, setBookingHours] = useState(0);

  // If today's date is selected but it's past closing time, update to tomorrow
  useEffect(() => {
    if (startDate && isToday(startDate)) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const closingTimeMinutes = 23 * 60;
      if (nowMinutes >= closingTimeMinutes) {
        const tomorrow = addDays(today, 1);
        setStartDate(tomorrow);
        setStartTime("6:00 AM");
      }
    }
  }, [startDate, today, setStartDate, setStartTime]);

  // Auto-calculate endTime based on startTime and bookingHours
  useEffect(() => {
    if (startTime && bookingHours > 0) {
      const startMins = timeStringToMinutes(startTime);
      const endMins = startMins + bookingHours * 60;
      const newEndTime = minutesToTimeString(endMins);
      setEndTime(newEndTime);
    } else {
      setEndTime("");
    }
  }, [startTime, bookingHours, setEndTime]);

  // Validate and process booking details.
  const handleNext = async () => {
    const newErrors = {
      startDate: !startDate,
      startTime: !startTime,
      endTime: !endTime,
    };

    if (bookingHours <= 0) {
      alert("Please select the number of booking hours (at least 1).");
      newErrors.startTime = true;
      newErrors.endTime = true;
    }
    if (!startDate) {
      alert("Please select a date.");
    }
    if (!startTime) {
      alert("Please select a start time.");
    }
    if (!endTime) {
      alert("Something went wrong with end time calculation.");
    }

    setErrors(newErrors);

    if (Object.values(newErrors).some((val) => val === true)) {
      return;
    }

    try {
      // Navigate to services page
      router.push("/services");
    } catch (error) {
      console.error("Error during booking:", error);
      alert("Sorry, something went wrong while booking. Please try again.");
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        {/* LEFT SIDE: Booking Hours, Start Time, Calendar */}
        <div className={styles.leftSide}>
          <div>
            {/* Calendar Section */}
            <div className="w-full mt-4">
              <Calendar
                mode="single"
                inline
                selected={startDate}
                disabled={{ before: new Date() }}
                onSelect={(value) => {
                  setStartDate(value);
                }}
                numberOfMonths={1}
                className="w-full"
                classNames={{
                  day_disabled:
                    "border border-[#f8f8f8] opacity-50 cursor-not-allowed",
                }}
              />
            </div>
          </div>
          {/* Booking Hours and TimeSlider Section */}
          <div className="w-full h-full mt-1">
            <div className="w-full mt-1 mb-3">
              <label className="text-xs font-bold mb-1 block">
                How many hours would you like to book?
              </label>
              <div className="flex items-center p-[6px] justify-between bg-[#f8f8f8]">
                <button
                  onClick={() => {
                    setBookingHours((prev) => Math.max(1, prev - 1));
                  }}
                  className="px-2"
                >
                  –
                </button>
                <span className="mx-2">{bookingHours}</span>
                <button
                  onClick={() => {
                    setBookingHours((prev) => Math.min(17, prev + 1));
                  }}
                  className="px-2"
                >
                  +
                </button>
              </div>
            </div>
            <label className="text-[12px] font-bold mb-1 block">
              What time would you like to start on{" "}
              {startDate ? format(startDate, "EEEE, MMMM d") : ""}?
            </label>
            {bookingHours <= 0 ? (
              <div className="text-gray-500 w-full h-[80%] bg-[#f8f8f8] flex items-center justify-center text-sm">
                Select booking hours first
              </div>
            ) : (
              <TimeSlider
                title="Start Time"
                value={startTime}
                onChange={(val) => {
                  setStartTime(val);
                }}
                handleNext={handleNext}
                selectedDate={startDate}
                bookingHours={bookingHours}
              />
            )}
            {errors.startTime && (
              <p className="text-red-500 text-xs mt-1">
                * Start time is required
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
