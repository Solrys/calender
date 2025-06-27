import React, { useState, useEffect, useCallback } from "react";
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
import AdminNav from "@/components/AdminNav/AdminNav";
import Head from "next/head";

// Timezone-neutral date formatting function
const formatDateForDisplay = (dateString, syncVersion, paymentStatus) => {
  // Extract date from ISO string to avoid timezone conversion
  const isoDate = new Date(dateString).toISOString();
  const datePart = isoDate.split("T")[0]; // Gets "2025-07-28"
  const [year, month, day] = datePart.split("-");

  // SAFER LOGIC: Only bookings with the SPECIFIC new sync version are already correct
  // This prevents affecting existing manual bookings that might be working correctly
  const isNewFixedBooking = syncVersion === "v3.4-service-booking";

  // Only add +1 day for bookings that haven't been corrected yet
  // BUT NOT for bookings created with the new timezone-fixed handler
  const needsCorrection =
    !isNewFixedBooking &&
    (!syncVersion ||
      (!syncVersion.includes("v3.1-date-corrected") &&
        !syncVersion.includes("v3.4-calendar-database-synced")));

  if (needsCorrection) {
    // DASHBOARD FIX: Add +1 day to match Google Calendar display for uncorrected bookings
    const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
    correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);

    // Convert to local date for formatting
    const localDate = new Date(
      correctedDate.getUTCFullYear(),
      correctedDate.getUTCMonth(),
      correctedDate.getUTCDate()
    );
    return format(localDate, "MMM d, yyyy");
  } else {
    // For new fixed bookings, use the date as-is (no +1 day correction)
    const localDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );
    return format(localDate, "MMM d, yyyy");
  }
};

// Helper function for month/year filtering
const getDatePartsForFilter = (dateString, syncVersion, paymentStatus) => {
  const isoDate = new Date(dateString).toISOString();
  const datePart = isoDate.split("T")[0]; // Gets "2025-07-28"
  const [year, month, day] = datePart.split("-");

  // SAFER LOGIC: Only bookings with the SPECIFIC new sync version are already correct
  // This prevents affecting existing manual bookings that might be working correctly
  const isNewFixedBooking = syncVersion === "v3.4-service-booking";

  // Only add +1 day for bookings that haven't been corrected yet
  // BUT NOT for bookings created with the new timezone-fixed handler
  const needsCorrection =
    !isNewFixedBooking &&
    (!syncVersion ||
      (!syncVersion.includes("v3.1-date-corrected") &&
        !syncVersion.includes("v3.4-calendar-database-synced")));

  if (needsCorrection) {
    // DASHBOARD FIX: Add +1 day to match display correction
    const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
    correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);

    return {
      year: correctedDate.getUTCFullYear().toString(),
      month: (correctedDate.getUTCMonth() + 1).toString().padStart(2, "0"),
      day: correctedDate.getUTCDate().toString().padStart(2, "0"),
    };
  } else {
    // For new fixed bookings, use the date as-is (no +1 day correction)
    return {
      year: year,
      month: month,
      day: day,
    };
  }
};

// Service display component for rendering service items
const ServiceDisplay = ({ services }) => {
  if (!services || services.length === 0) return <span>None</span>;

  return (
    <div className="space-y-1 text-sm">
      {services.map((service, index) => (
        <div key={index}>
          {service.name} {service.quantity > 1 ? `(${service.quantity})` : ""}
        </div>
      ))}
    </div>
  );
};

function ServiceDashboard() {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sortOption, setSortOption] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (hasLoaded) return; // Prevent multiple calls

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/service-bookings", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }

      const data = await res.json();

      if (data && Array.isArray(data.bookings)) {
        const sortedBookings = data.bookings.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setBookings(sortedBookings);
        setFilteredBookings(sortedBookings);
      }

      setHasLoaded(true);
    } catch (err) {
      console.error("Error fetching service bookings:", err);
      setError("Failed to load service bookings");
    } finally {
      setIsLoading(false);
    }
  }, [hasLoaded]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleFilter = () => {
    let filtered = [...bookings];

    if (monthFilter) {
      filtered = filtered.filter((b) => {
        const date = new Date(b.startDate);
        return (
          (date.getMonth() + 1).toString().padStart(2, "0") === monthFilter
        );
      });
    }

    if (yearFilter) {
      filtered = filtered.filter((b) => {
        const date = new Date(b.startDate);
        return date.getFullYear().toString() === yearFilter;
      });
    }

    if (sortOption === "date-asc") {
      filtered.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    } else if (sortOption === "date-desc") {
      filtered.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    } else if (sortOption === "service-asc") {
      filtered.sort((a, b) => {
        const serviceA = a.services && a.services[0] ? a.services[0].name : "";
        const serviceB = b.services && b.services[0] ? b.services[0].name : "";
        return serviceA.localeCompare(serviceB);
      });
    } else if (sortOption === "service-desc") {
      filtered.sort((a, b) => {
        const serviceA = a.services && a.services[0] ? a.services[0].name : "";
        const serviceB = b.services && b.services[0] ? b.services[0].name : "";
        return serviceB.localeCompare(serviceA);
      });
    }

    setFilteredBookings(filtered);
  };

  const clearFilters = () => {
    setMonthFilter("");
    setYearFilter("");
    setSortOption("");
    setFilteredBookings(bookings);
  };

  const exportCSV = () => {
    if (filteredBookings.length === 0) {
      alert("No data to export!");
      return;
    }

    const exportDate = new Date().toLocaleDateString();
    const headers =
      "Booking Time,Customer Name,Customer Phone,Customer Email,Payment Status,Date,Start Time,End Time,Subtotal,Total,Services\n";

    const csvRows = filteredBookings.map((b) => {
      const services =
        b.services && b.services.length > 0
          ? b.services
              .map((service) => `${service.name} (${service.quantity || 1})`)
              .join("; ")
          : "None";

      return `${format(new Date(b.createdAt), "MMM d, yyyy HH:mm:ss")},${
        b.customerName
      },${b.customerPhone},${b.customerEmail},${b.paymentStatus},${format(
        new Date(b.startDate),
        "MMM d, yyyy"
      )},${b.startTime},${b.endTime},${b.subtotal},${
        b.estimatedTotal
      },${services}`;
    });

    const csvData = `Service Bookings Export - ${exportDate}\n\n${headers}${csvRows.join(
      "\n"
    )}`;
    const blob = new Blob([csvData], { type: "text/csv" });
    saveAs(blob, `service-bookings-${exportDate}.csv`);
  };

  const cancelServiceBooking = async (bookingId) => {
    if (!confirm("Are you sure you want to cancel this service booking?")) {
      return;
    }

    try {
      const res = await fetch(`/api/service-bookings?id=${bookingId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to cancel booking");
      }

      alert("Service booking cancelled successfully");
      setBookings((prev) => prev.filter((b) => b._id !== bookingId));
      setFilteredBookings((prev) => prev.filter((b) => b._id !== bookingId));
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Failed to cancel booking");
    }
  };

  if (!hasLoaded) {
    return (
      <>
        <Head>
          <title>Service Bookings Dashboard</title>
        </Head>
        <AdminNav />
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Service Bookings Dashboard</h2>
          <div className="text-center py-10">
            <p>Loading...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Service Bookings Dashboard</title>
      </Head>
      <AdminNav />
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Service Bookings Dashboard</h2>

        {isLoading && (
          <div className="text-center py-10">
            <p>Loading service bookings...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-10 text-red-500">
            <p>{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Controls */}
            <div className="hidden md:flex items-center gap-4 mb-4 flex-nowrap">
              <Select onValueChange={setMonthFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                      {format(new Date(2025, i, 1), "MMMM")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={setYearFilter}>
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
              <Select onValueChange={setSortOption}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-asc">Date Ascending</SelectItem>
                  <SelectItem value="date-desc">Date Descending</SelectItem>
                  <SelectItem value="service-asc">Service A–Z</SelectItem>
                  <SelectItem value="service-desc">Service Z–A</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleFilter}>Apply Filters</Button>
              <Button onClick={clearFilters}>Clear Filters</Button>
              <Button onClick={exportCSV}>Export CSV</Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking Time</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Customer Phone</TableHead>
                    <TableHead>Customer Email</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Cancel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="text-center text-gray-500"
                      >
                        No service bookings found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
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
                        <TableCell>{booking.paymentStatus}</TableCell>
                        <TableCell>
                          {format(new Date(booking.startDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{booking.startTime}</TableCell>
                        <TableCell>{booking.endTime}</TableCell>
                        <TableCell>${booking.subtotal}</TableCell>
                        <TableCell>${booking.estimatedTotal}</TableCell>
                        <TableCell>
                          <ServiceDisplay services={booking.services} />
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => cancelServiceBooking(booking._id)}
                          >
                            Cancel
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default ServiceDashboard;
