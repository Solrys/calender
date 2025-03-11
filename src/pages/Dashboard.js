import React, { useState, useEffect } from "react";
import { format, parse } from "date-fns";
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
          // Sort bookings in descending order by startDate by default.
          const sortedBookings = data.bookings.sort(
            (a, b) => new Date(b.startDate) - new Date(a.startDate)
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
        (b) => format(new Date(b.startDate), "MM") === monthFilter
      );
    }
    if (yearFilter) {
      filtered = filtered.filter(
        (b) => format(new Date(b.startDate), "yyyy") === String(yearFilter)
      );
    }

    // Sorting mechanism
    if (sortOption === "date-asc") {
      filtered.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    } else if (sortOption === "date-desc") {
      filtered.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    } else if (sortOption === "studio-asc") {
      filtered.sort((a, b) => a.studio.localeCompare(b.studio));
    } else if (sortOption === "studio-desc") {
      filtered.sort((a, b) => b.studio.localeCompare(a.studio));
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

    // Get today's local date (without the time)
    const exportDate = new Date().toLocaleDateString();

    // Create an export header row without the Surcharge column.
    const exportHeader = `Exported On: ${exportDate}\n\n`;

    // Added Payment Status column after Studio.
    const headers =
      "Booking Time,Customer Name,Customer Phone,Customer Email,Studio,Payment Status,Date,Start Time,End Time,Subtotal,Total,Add‑ons,Total Hours\n";

    const csvRows = filteredBookings.map((b) => {
      // Build add-ons string from items array.
      const addOns =
        b.items && b.items.length > 0
          ? b.items
              .filter((item) => item.quantity > 0)
              .map((item) => `${item.name} (${item.quantity})`)
              .join("; ")
          : "None";

      // Compute total hours using date-fns parse (using startDate for both start and end times).
      let totalHours = "N/A";
      try {
        const startDateTime = parse(
          `${format(new Date(b.startDate), "yyyy-MM-dd")} ${b.startTime}`,
          "yyyy-MM-dd h:mm a",
          new Date()
        );
        const endDateTime = parse(
          `${format(new Date(b.startDate), "yyyy-MM-dd")} ${b.endTime}`,
          "yyyy-MM-dd h:mm a",
          new Date()
        );
        totalHours = ((endDateTime - startDateTime) / (1000 * 60 * 60)).toFixed(
          1
        );
      } catch (e) {
        console.error("Error calculating total hours", e);
      }

      return `${format(new Date(b.createdAt), "yyyy-MM-dd HH:mm:ss")},${
        b.customerName
      },${b.customerPhone},${b.customerEmail},${b.studio},${
        b.paymentStatus
      },${format(new Date(b.startDate), "yyyy-MM-dd")},${b.startTime},${
        b.endTime
      },${b.subtotal},${b.estimatedTotal},${addOns},${totalHours}`;
    });

    const csvData = exportHeader + headers + csvRows.join("\n");
    console.log("📂 CSV Data:\n", csvData);

    const blob = new Blob([csvData], { type: "text/csv" });
    const fileName = `bookings-${exportDate}.csv`;
    saveAs(blob, fileName);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Bookings Dashboard</h2>
      {/* Inline filter & sort controls */}
      {/* Desktop view (md and up): one row */}
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

      {/* Mobile view (below md): two rows of 3 items each */}
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

      {/* Responsive table container */}
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-gray-500">
                  No bookings found.
                </TableCell>
              </TableRow>
            ) : (
              filteredBookings.map((booking) => {
                // Compute total hours (using startDate for both start and end time)
                let totalHours = "N/A";
                try {
                  const startDateTime = parse(
                    `${format(new Date(booking.startDate), "yyyy-MM-dd")} ${
                      booking.startTime
                    }`,
                    "yyyy-MM-dd h:mm a",
                    new Date()
                  );
                  const endDateTime = parse(
                    `${format(new Date(booking.startDate), "yyyy-MM-dd")} ${
                      booking.endTime
                    }`,
                    "yyyy-MM-dd h:mm a",
                    new Date()
                  );
                  totalHours = (
                    (endDateTime - startDateTime) /
                    (1000 * 60 * 60)
                  ).toFixed(1);
                } catch (e) {
                  console.error("Error calculating total hours", e);
                }

                return (
                  <TableRow key={booking._id}>
                    <TableCell>
                      {format(
                        new Date(booking.createdAt),
                        "yyyy-MM-dd HH:mm:ss"
                      )}
                    </TableCell>
                    <TableCell>{booking.customerName}</TableCell>
                    <TableCell>{booking.customerPhone}</TableCell>
                    <TableCell>{booking.customerEmail}</TableCell>
                    <TableCell>{booking.studio}</TableCell>
                    <TableCell>{booking.paymentStatus}</TableCell>
                    <TableCell>
                      {format(new Date(booking.startDate), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell>{booking.startTime}</TableCell>
                    <TableCell>{booking.endTime}</TableCell>
                    <TableCell>${booking.subtotal}</TableCell>
                    <TableCell>${booking.estimatedTotal}</TableCell>
                    <TableCell>
                      <AddonsDisplay items={booking.items} />
                    </TableCell>
                    <TableCell>{totalHours} hours</TableCell>
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
