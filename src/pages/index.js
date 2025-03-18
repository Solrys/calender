import React, { useContext, useState, useEffect, useMemo } from "react";
import { format, startOfDay, addDays, isToday } from "date-fns";
import { MdLocationOn } from "react-icons/md";
// shadcn/ui components
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import styles from "@/styles/Home.module.css";
import { BookingContext } from "@/context/BookingContext";
import { useRouter } from "next/router";

// Import helper for blocked times and time conversions
import {
  computeBlockedTimesByDate,
  minutesToTimeString,
  timeStringToMinutes,
} from "@/utils/bookingHelpers";

// Import TimeSlider (NEW)
import TimeSlider from "@/components/TimeSlider/TimeSlider";

export default function BookingPage() {
  const {
    studiosList,
    selectedStudio,
    setSelectedStudio,
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
    studio: false,
    startDate: false,
    startTime: false,
  });

  // Local state for booking hours. Default is 0 (i.e. not selected).
  const [bookingHours, setBookingHours] = useState(0);

  // Compute blocked times for the selected date.
  const [blockedTimesByDate, setBlockedTimesByDate] = useState({});

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

  // Fetch existing bookings for the selected studio and date.
  useEffect(() => {
    async function fetchBookings() {
      if (!selectedStudio || !startDate) return;
      const formattedDate = format(startDate, "yyyy-MM-dd");
      try {
        const res = await fetch(`/api/booking`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        // Compute blocked times with special handling for the fourth studio.
        const filteredBookings = (data.bookings || []).filter((booking) => {
          if (
            selectedStudio.name === "BOTH THE LAB & THE EXTENSION FOR EVENTS"
          ) {
            // Combine bookings for THE LAB, THE EXTENSION, and BOTH option.
            return (
              (booking.studio === "THE LAB" ||
                booking.studio === "THE EXTENSION" ||
                booking.studio === "BOTH THE LAB & THE EXTENSION FOR EVENTS") &&
              format(new Date(booking.startDate), "yyyy-MM-dd") ===
                formattedDate
            );
          }
          return (
            booking.studio === selectedStudio.name &&
            format(new Date(booking.startDate), "yyyy-MM-dd") === formattedDate
          );
        });
        const blockedByDate = computeBlockedTimesByDate(filteredBookings);
        setBlockedTimesByDate(blockedByDate);
      } catch (error) {
        console.error("Error fetching bookings:", error);
      }
    }
    fetchBookings();
  }, [selectedStudio, startDate]);

  const startDateKey = startDate ? format(startDate, "yyyy-MM-dd") : "";
  const blockedTimesForStartDate = useMemo(
    () => blockedTimesByDate[startDateKey] || new Set(),
    [blockedTimesByDate, startDateKey]
  );

  // Determine minimum allowed booking hours (special studio requires at least 2)
  const minBookingHours =
    selectedStudio &&
    selectedStudio.name === "BOTH THE LAB & THE EXTENSION FOR EVENTS"
      ? 2
      : 0;

  // Validate and process booking details.
  const handleNext = async () => {
    const newErrors = {
      studio: !selectedStudio,
      startDate: !startDate,
      startTime: !startTime,
      endTime: !endTime,
    };

    if (!selectedStudio) {
      alert("Please select a studio.");
    }
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
      // Your API call would go here (e.g. saving to backend)
      router.push("/addons");
    } catch (error) {
      console.error("Error during booking:", error);
      alert("Sorry, something went wrong while booking. Please try again.");
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        {/* LEFT SIDE: Studio Selection, Booking Hours, Start Time, Calendar */}
        <div className={styles.leftSide}>
          <div>
            <div className={styles.wrap}>
              <div className="w-[100%] sm:w-[92%]">
                <label className="w-40 text-[18px] font-bold mb-1">
                  Select Studio
                </label>
                <Select
                  value={selectedStudio ? selectedStudio.name : ""}
                  onValueChange={(studioName) => {
                    const studioObj = studiosList.find(
                      (s) => s.name === studioName
                    );
                    setSelectedStudio(studioObj);
                    setBookingHours(0);
                    setStartTime("");
                    setEndTime("");
                  }}
                >
                  <SelectTrigger className="w-full bg-[#f8f8f8] text-black">
                    <MdLocationOn className="mr-1" />
                    <SelectValue placeholder="Select Studio" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#f8f8f8] text-black">
                    {studiosList.map((studio) => (
                      <SelectItem
                        key={studio.name}
                        value={studio.name}
                        className="text-xs"
                      >
                        {studio.name} (${studio.pricePerHour.toFixed(2)}/Hr)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.studio && (
                  <p className="text-red-500 text-xs mt-1">
                    * Studio is required
                  </p>
                )}
              </div>
            </div>
            {/* Calendar Section */}
            <div className="w-full mt-4">
              <Calendar
                mode="single"
                inline
                selected={startDate}
                disabled={{ before: new Date() }}
                onSelect={(value) => {
                  if (!selectedStudio) {
                    alert("Please select a studio first.");
                    return;
                  }
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
          <div className="w-full h-full mt-4">
            <div className="w-full mt-1 mb-3">
              <label className="text-xs font-bold mb-1 block">
                How many hours would you like to rent?
              </label>
              <div className="flex items-center p-[6px] justify-between bg-[#f8f8f8]">
                <button
                  onClick={() => {
                    if (!selectedStudio) {
                      alert("Please select a studio first.");
                      return;
                    }
                    setBookingHours((prev) =>
                      Math.max(minBookingHours, prev - 1)
                    );
                  }}
                  className="px-2"
                >
                  –
                </button>
                <span className="mx-2">{bookingHours}</span>
                <button
                  onClick={() => {
                    if (!selectedStudio) {
                      alert("Please select a studio first.");
                      return;
                    }
                    setBookingHours((prev) => Math.min(17, prev + 1));
                  }}
                  className="px-2"
                >
                  +
                </button>
              </div>
            </div>
            <label className="text-xs font-bold mb-1 block">
              What time wold you like to start on{" "}
              {startDate ? format(startDate, "EEEE, MMMM d") : ""}
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
                  if (!selectedStudio) {
                    alert("Please select a studio first.");
                    return;
                  }
                  setStartTime(val);
                }}
                handleNext={handleNext}
                selectedDate={startDate}
                blockedTimes={blockedTimesForStartDate}
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

        {/* NEXT BUTTON */}
        {/* <div className={styles.rightSide}>
          <Button
            variant="default"
            className="mt-4 h-12 px-10"
            onClick={handleNext}
          >
            Next
          </Button>
        </div> */}
      </div>
    </div>
  );
}
