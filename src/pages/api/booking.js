import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import { deleteCalendarEvent } from "@/utils/calenderEvent";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "POST") {
    try {
      const {
        studio,
        startDate,
        startTime,
        endTime,
        items,
        subtotal,
        estimatedTotal,
      } = req.body;

      const recalculatedSubtotal = items.reduce(
        (acc, item) => acc + item.quantity * item.price,
        0
      );
      if (Number(subtotal) !== recalculatedSubtotal) {
        return res.status(400).json({ message: "Invalid subtotal" });
      }

      const recalculatedTotal = recalculatedSubtotal;
      if (Number(estimatedTotal) !== recalculatedTotal) {
        return res.status(400).json({ message: "Total mismatch" });
      }

      const booking = new Booking({
        studio,
        startDate,
        startTime,
        endTime,
        items,
        subtotal: recalculatedSubtotal,
        estimatedTotal: recalculatedTotal,
      });

      await booking.save();
      res.status(201).json({ message: "Booking saved", booking });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  } else if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    try {
      // SAFETY FIX: Only clean up abandoned website bookings, never calendar-synced ones
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const deletedBookings = await Booking.deleteMany({
        paymentStatus: "pending",
        createdAt: { $lt: thirtyMinutesAgo },
        calendarEventId: { $exists: false } // CRITICAL: Only delete bookings WITHOUT calendar events
      });

      if (deletedBookings.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedBookings.deletedCount} abandoned website bookings (calendar bookings preserved)`);
      }

      const bookings = await Booking.find({});
      res.status(200).json({ bookings });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  } else if (req.method === "DELETE") {
    try {
      // Get booking id from query parameters: /api/booking?id=BOOKING_ID
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ message: "Missing booking id" });
      }

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // If booking has a Google Calendar event, attempt to delete it from the correct calendar
      if (booking.calendarEventId) {
        try {
          // UPDATED: Determine booking type and delete from correct calendar
          const bookingType = booking.paymentStatus === "manual" ? "manual" : "website";

          console.log(`🗑️ Deleting ${bookingType} booking calendar event: ${booking.calendarEventId}`);
          await deleteCalendarEvent(booking.calendarEventId, bookingType);

          console.log(`✅ Successfully deleted calendar event for ${bookingType} booking`);
        } catch (calError) {
          console.error("❌ Error deleting calendar event:", calError);
          // Continue with booking deletion even if calendar deletion fails
          console.log("⚠️ Continuing with database booking deletion despite calendar error");
        }
      }

      const deletedBooking = await Booking.findByIdAndDelete(id);
      if (!deletedBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      console.log(`✅ Successfully deleted booking: ${deletedBooking.customerName || 'No name'} - ${deletedBooking.studio}`);

      res.status(200).json({
        message: "Booking cancelled successfully",
        booking: deletedBooking
      });
    } catch (error) {
      console.error("❌ Error cancelling booking:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
