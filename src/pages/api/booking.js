import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "POST") {
    try {
      // Extract data from request body (you should validate these fields)
      const {
        studio,
        startDate,
        startTime,
        endTime,
        items,
        subtotal,

        estimatedTotal,
      } = req.body;

      // Recalculate totals on the server for security:
      // Recalculate totals on the server for security:
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

      // Save the booking in your database
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
    console.log("hello");
    // Disable caching by setting the Cache-Control header:
    res.setHeader("Cache-Control", "no-store, max-age=0");

    try {
      // Fetch all booking details from the database
      const bookings = await Booking.find({});
      res.status(200).json({ bookings });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  } else if (req.method === "POST") {
    // ... your POST code ...
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
