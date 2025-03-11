import React, { useContext, useState, useEffect, useMemo } from "react";
import { format, startOfDay, addDays, isToday } from "date-fns";
import { MdCalendarMonth, MdAccessTime, MdLocationOn } from "react-icons/md";
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

// Import helper for blocked times
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

  // Handle calendar update when today is selected but past closing time
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
  useEffect(() => {
    if (startTime && bookingHours > 0) {
      // Convert start time to minutes, add (bookingHours * 60), then convert back to string
      const startMins = timeStringToMinutes(startTime);
      const endMins = startMins + bookingHours * 60;
      const newEndTime = minutesToTimeString(endMins);
      setEndTime(newEndTime);
    } else {
      // If bookingHours=0 or no start time, clear endTime
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
        // Compute blocked times
        const filteredBookings = (data.bookings || []).filter(
          (booking) =>
            booking.studio === selectedStudio.name &&
            format(new Date(booking.startDate), "yyyy-MM-dd") === formattedDate
        );
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

  // Determine the minimum allowed booking hours
  const minBookingHours =
    selectedStudio &&
    selectedStudio.name === "BOTH THE LAB & THE EXTENSION FOR EVENTS"
      ? 2
      : 0;

  // Validate and process booking details.
  const handleNext = async () => {
    // Build an errors object
    const newErrors = {
      studio: !selectedStudio,
      startDate: !startDate,
      startTime: !startTime,
      endTime: !endTime, // We'll assume endTime is being auto-calculated
    };

    // 1) Basic validations
    if (!selectedStudio) {
      alert("Please select a studio.");
    }

    if (bookingHours <= 0) {
      alert("Please select the number of booking hours (at least 1).");
      // If bookingHours is zero or negative, also mark startTime as invalid
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

    // 2) Update local error state
    setErrors(newErrors);

    // If any validation failed, stop here
    if (Object.values(newErrors).some((val) => val === true)) {
      return;
    }

    try {
      // 4) Make the API call

      // 5) Navigate to the next page on success
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
              <div className="w-full">
                <label className="w-40 text-xs font-bold mb-1">
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

              {/* Booking Hours */}
              <div className="w-full mt-1">
                <label className="text-xs font-bold mb-1 block">
                  Booking Hours
                </label>
                <div className="flex items-center p-[6px]  bg-[#f8f8f8]">
                  <button
                    onClick={() =>
                      setBookingHours((prev) =>
                        Math.max(minBookingHours, prev - 1)
                      )
                    }
                    className="px-2"
                  >
                    –
                  </button>
                  <span className="mx-2">{bookingHours}</span>
                  <button
                    onClick={() =>
                      setBookingHours((prev) => Math.min(17, prev + 1))
                    }
                    className="px-2"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Start Time using TimeSlider */}
              {/* <div className="w-full mt-4">
              <label className="text-xs font-bold mb-1 block">Start Time</label>
              {bookingHours <= 0 ? (
                <div className="text-gray-500">Select booking hours first</div>
              ) : (
                <TimeSlider
                  title="Start Time"
                  value={startTime}
                  onChange={setStartTime}
                  selectedDate={startDate}
                  blockedTimes={blockedTimesForStartDate}
                  bookingHours={bookingHours} // Pass selected booking hours
                />
              )}
              {errors.startTime && (
                <p className="text-red-500 text-xs mt-1">
                  * Start time is required
                </p>
              )}
            </div> */}
            </div>
            <div className="w-full mt-4">
              <Calendar
                mode="single"
                inline
                selected={startDate}
                disabled={{ before: new Date() }}
                onSelect={(value) => setStartDate(value)}
                numberOfMonths={1}
                className="w-full"
              />
            </div>
          </div>
          <div className="w-full h-full">
            <label className="text-xs font-bold mb-1 block">Start Time</label>
            {bookingHours <= 0 ? (
              <div className="text-gray-500">Select booking hours first</div>
            ) : (
              <TimeSlider
                title="Start Time"
                value={startTime}
                onChange={setStartTime}
                selectedDate={startDate}
                blockedTimes={blockedTimesForStartDate}
                bookingHours={bookingHours} // Pass selected booking hours
              />
            )}
            {errors.startTime && (
              <p className="text-red-500 text-xs mt-1">
                * Start time is required
              </p>
            )}
          </div>

          {/* Calendar */}
        </div>

        {/* NEXT BUTTON */}
        <div className={styles.rightSide}>
          <Button
            variant="default"
            className="mt-4 h-12 px-10"
            onClick={handleNext}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
