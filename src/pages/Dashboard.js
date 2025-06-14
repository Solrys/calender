import React, { useState, useEffect } from "react";
import { format, parse } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { saveAs } from "file-saver";
import AddonsDisplay from "@/components/Addon/AddonDisplay";

// Timezone-neutral date formatting function
const formatDateForDisplay = (dateString, syncVersion, paymentStatus) => {
  // Extract date from ISO string to avoid timezone conversion
  const isoDate = new Date(dateString).toISOString();
  const datePart = isoDate.split('T')[0]; // Gets "2025-07-28"
  const [year, month, day] = datePart.split('-');

  // SAFER LOGIC: Only bookings with the SPECIFIC new sync version are already correct
  // This prevents affecting existing manual bookings that might be working correctly
  const isNewFixedBooking = syncVersion === 'v2.5-date-timezone-fixed';

  // Only add +1 day for bookings that haven't been corrected yet
  // BUT NOT for bookings created with the new timezone-fixed handler
  const needsCorrection = !isNewFixedBooking &&
    (!syncVersion ||
      !syncVersion.includes('v3.1-date-corrected'));

  if (needsCorrection) {
    // DASHBOARD FIX: Add +1 day to match Google Calendar display for uncorrected bookings
    const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
    correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);

    // Convert to local date for formatting
    const localDate = new Date(correctedDate.getUTCFullYear(), correctedDate.getUTCMonth(), correctedDate.getUTCDate());
    return format(localDate, "MMM d, yyyy");
  } else {
    // For new fixed bookings, use the date as-is (no +1 day correction)
    const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return format(localDate, "MMM d, yyyy");
  }
};

// Helper function for month/year filtering
const getDatePartsForFilter = (dateString, syncVersion, paymentStatus) => {
  const isoDate = new Date(dateString).toISOString();
  const datePart = isoDate.split('T')[0]; // Gets "2025-07-28"
  const [year, month, day] = datePart.split('-');

  // SAFER LOGIC: Only bookings with the SPECIFIC new sync version are already correct
  // This prevents affecting existing manual bookings that might be working correctly
  const isNewFixedBooking = syncVersion === 'v2.5-date-timezone-fixed';

  // Only add +1 day for bookings that haven't been corrected yet
  // BUT NOT for bookings created with the new timezone-fixed handler
  const needsCorrection = !isNewFixedBooking &&
    (!syncVersion ||
      !syncVersion.includes('v3.1-date-corrected'));

  if (needsCorrection) {
    // DASHBOARD FIX: Add +1 day to match display correction
    const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
    correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);

    return {
      year: correctedDate.getUTCFullYear().toString(),
      month: (correctedDate.getUTCMonth() + 1).toString().padStart(2, '0'),
      day: correctedDate.getUTCDate().toString().padStart(2, '0')
    };
  } else {
    // For new fixed bookings, use the date as-is (no +1 day correction)
    return {
      year: year,
      month: month,
      day: day
    };
  }
};

export default function BookingDashboard() {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sortOption, setSortOption] = useState("");

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await fetch("/api/booking");
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        const data = await res.json();
        console.log("✅ Fetched bookings:", data);
        if (data && Array.isArray(data.bookings)) {
          const sortedBookings = data.bookings.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          setBookings(sortedBookings);
          setFilteredBookings(sortedBookings);
        } else {
          setBookings([]);
          setFilteredBookings([]);
        }
      } catch (error) {
        console.error("❌ Error fetching bookings:", error);
      }
    };
    fetchBookings();
  }, []);

  const handleFilter = () => {
    let filtered = [...bookings];

    if (monthFilter) {
      filtered = filtered.filter(
        (b) => getDatePartsForFilter(b.startDate, b.syncVersion, b.paymentStatus).month === monthFilter
      );
    }
    if (yearFilter) {
      filtered = filtered.filter(
        (b) => getDatePartsForFilter(b.startDate, b.syncVersion, b.paymentStatus).year === String(yearFilter)
      );
    }

    if (sortOption === "date-asc") {
      filtered.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    } else if (sortOption === "date-desc") {
      filtered.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    } else if (sortOption === "studio-asc") {
      filtered.sort((a, b) => a.studio.localeCompare(b.studio));
    } else if (sortOption === "studio-desc") {
      filtered.sort((a, b) => b.studio.localeCompare(a.studio));
    } else {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    console.log("📌 Filtered Bookings:", filtered);
    setFilteredBookings(filtered);
  };

  const clearFilters = () => {
    setMonthFilter("");
    setYearFilter("");
    setSortOption("");
    setFilteredBookings(bookings);
  };

  const exportCSV = () => {
    console.log("📂 Exporting CSV...");
    console.log("📂 Data to export:", filteredBookings);

    if (filteredBookings.length === 0) {
      alert("No data to export!");
      return;
    }

    const exportDate = new Date().toLocaleDateString();
    const exportHeader = `Exported On: ${exportDate}\n\n`;
    const headers =
      "Booking Time,Customer Name,Customer Phone,Customer Email,Studio,Payment Status,Date,Start Time,End Time,Subtotal,Total,Add‑ons,Total Hours\n";

    const csvRows = filteredBookings.map((b) => {
      const addOns =
        b.items && b.items.length > 0
          ? b.items
            .filter((item) => item.quantity > 0)
            .map((item) => `${item.name} (${item.quantity})`)
            .join("; ")
          : "None";

      let totalHours = "N/A";
      try {
        const dateParts = getDatePartsForFilter(b.startDate, b.syncVersion, b.paymentStatus);
        const dateString = `${dateParts.year}-${dateParts.month.padStart(2, '0')}-${dateParts.day.padStart(2, '0')}`;
        const startDateTime = parse(
          `${dateString} ${b.startTime}`,
          "yyyy-MM-dd h:mm a",
          new Date()
        );
        const endDateTime = parse(
          `${dateString} ${b.endTime}`,
          "yyyy-MM-dd h:mm a",
          new Date()
        );
        totalHours = ((endDateTime - startDateTime) / (1000 * 60 * 60)).toFixed(
          1
        );
      } catch (e) {
        console.error("Error calculating total hours", e);
      }

      return `${format(new Date(b.createdAt), "MMM d, yyyy HH:mm:ss")},${b.customerName
        },${b.customerPhone},${b.customerEmail},${b.studio},${b.paymentStatus
        },${formatDateForDisplay(b.startDate, b.syncVersion, b.paymentStatus)},${b.startTime},${b.endTime
        },${b.subtotal},${b.estimatedTotal},${addOns},${totalHours}`;
    });

    const csvData = exportHeader + headers + csvRows.join("\n");
    console.log("📂 CSV Data:\n", csvData);

    const blob = new Blob([csvData], { type: "text/csv" });
    const fileName = `bookings-${exportDate}.csv`;
    saveAs(blob, fileName);
  };

  // Cancel a booking by calling the DELETE endpoint.
  const cancelBooking = async (bookingId) => {
    if (!confirm("Are you sure you want to cancel this booking?")) {
      return;
    }
    try {
      const res = await fetch(`/api/booking?id=${bookingId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to cancel booking");
      }
      const data = await res.json();
      alert("Booking cancelled successfully");
      // Remove the cancelled booking from state
      setBookings((prev) => prev.filter((b) => b._id !== bookingId));
      setFilteredBookings((prev) => prev.filter((b) => b._id !== bookingId));
    } catch (error) {
      console.error("Error cancelling booking", error);
      alert("Failed to cancel booking. Please try again.");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Bookings Dashboard</h2>
      {/* Inline filter & sort controls */}
      <div className="hidden md:flex items-center gap-4 mb-4 flex-nowrap">
        <Select onValueChange={(value) => setMonthFilter(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Month" />
          </SelectTrigger>
          <SelectContent>
            {[...Array(12)].map((_, i) => (
              <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                {format(new Date(2025, i, 1), "MMMM")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={(value) => setYearFilter(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Year" />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={(value) => setSortOption(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-asc">Date Ascending</SelectItem>
            <SelectItem value="date-desc">Date Descending</SelectItem>
            <SelectItem value="studio-asc">Studio A–Z</SelectItem>
            <SelectItem value="studio-desc">Studio Z–A</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleFilter}>Apply Filters</Button>
        <Button onClick={clearFilters}>Clear Filters</Button>
        <Button onClick={exportCSV}>Export CSV</Button>
      </div>

      {/* Mobile view filters */}
      <div className="md:hidden grid grid-cols-3 gap-4 mb-4">
        <Select onValueChange={(value) => setMonthFilter(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {[...Array(12)].map((_, i) => (
              <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                {format(new Date(2025, i, 1), "MMM")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={(value) => setYearFilter(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={(value) => setSortOption(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-asc">Date ↑</SelectItem>
            <SelectItem value="date-desc">Date ↓</SelectItem>
            <SelectItem value="studio-asc">Studio A-Z</SelectItem>
            <SelectItem value="studio-desc">Studio Z-A</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleFilter}>Apply</Button>
        <Button onClick={clearFilters}>Clear</Button>
        <Button onClick={exportCSV}>Export</Button>
      </div>

      {/* Bookings table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking Time</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Customer Phone</TableHead>
              <TableHead>Customer Email</TableHead>
              <TableHead>Studio</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>End Time</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Add‑ons</TableHead>
              <TableHead>Total Hours</TableHead>
              <TableHead>Cancel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-gray-500">
                  No bookings found.
                </TableCell>
              </TableRow>
            ) : (
              filteredBookings.map((booking) => {
                let totalHours = "N/A";
                try {
                  const dateParts = getDatePartsForFilter(booking.startDate, booking.syncVersion, booking.paymentStatus);
                  const dateString = `${dateParts.year}-${dateParts.month.padStart(2, '0')}-${dateParts.day.padStart(2, '0')}`;
                  const startDateTime = parse(
                    `${dateString} ${booking.startTime}`,
                    "yyyy-MM-dd h:mm a",
                    new Date()
                  );
                  const endDateTime = parse(
                    `${dateString} ${booking.endTime}`,
                    "yyyy-MM-dd h:mm a",
                    new Date()
                  );
                  totalHours = ((endDateTime - startDateTime) / (1000 * 60 * 60)).toFixed(
                    1
                  );
                } catch (e) {
                  console.error("Error calculating total hours", e);
                }

                return (
                  <TableRow key={booking._id}>
                    <TableCell>
                      {format(
                        new Date(booking.createdAt),
                        "MMM d, yyyy HH:mm:ss"
                      )}
                    </TableCell>
                    <TableCell>{booking.customerName}</TableCell>
                    <TableCell>{booking.customerPhone}</TableCell>
                    <TableCell>{booking.customerEmail}</TableCell>
                    <TableCell>{booking.studio}</TableCell>
                    <TableCell>{booking.paymentStatus}</TableCell>
                    <TableCell>
                      {formatDateForDisplay(booking.startDate, booking.syncVersion, booking.paymentStatus)}
                    </TableCell>
                    <TableCell>{booking.startTime}</TableCell>
                    <TableCell>{booking.endTime}</TableCell>
                    <TableCell>${booking.subtotal}</TableCell>
                    <TableCell>${booking.estimatedTotal}</TableCell>
                    <TableCell>
                      <AddonsDisplay items={booking.items} />
                    </TableCell>
                    <TableCell>{totalHours} hours</TableCell>
                    <TableCell>
                      <Button onClick={() => cancelBooking(booking._id)}>
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
