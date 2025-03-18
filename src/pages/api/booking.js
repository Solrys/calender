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

      // If booking has a Google Calendar event, attempt to delete it
      if (booking.calendarEventId) {
        try {
          await deleteCalendarEvent(booking.calendarEventId);
        } catch (calError) {
          console.error("Error deleting calendar event:", calError);
          // You can choose to either continue with deletion or abort here
        }
      }
      const deletedBooking = await Booking.findByIdAndDelete(id);
      if (!deletedBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      res
        .status(200)
        .json({ message: "Booking cancelled", booking: deletedBooking });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
