// ✅ Rewritten GET /api/verify-payment with better reliability and error safety

import Stripe from "stripe";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import { format } from "date-fns";
import createCalendarEvent from "@/utils/calenderEvent";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function convertTo24Hour(timeStr) {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (modifier.toUpperCase() === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:00`;
}

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { session_id } = req.query;
    if (!session_id)
      return res.status(400).json({ message: "Missing session ID" });

    console.log(`🔍 Verifying Stripe session: ${session_id}`);
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("✅ Stripe Session Retrieved:", session.id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const bookingId = session.metadata?.bookingId;
    if (!bookingId)
      return res.status(400).json({ message: "Missing bookingId in metadata" });

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { paymentStatus: "success" },
      { new: true }
    );

    if (!updatedBooking) {
      console.error("❌ Booking not found in DB, skipping calendar event");
      return res.status(404).json({ message: "Booking not found" });
    }

    const {
      studio,
      startDate,
      startTime,
      endTime,
      customerName,
      customerEmail,
      customerPhone,
      subtotal,
      studioCost,
      estimatedTotal,
      items = [],
    } = updatedBooking;

    const formattedDate = format(new Date(startDate), "yyyy-MM-dd");
    const startISO = new Date(
      `${formattedDate}T${convertTo24Hour(startTime)}-04:00`
    ).toISOString();
    const endISO = new Date(
      `${formattedDate}T${convertTo24Hour(endTime)}-04:00`
    ).toISOString();

    const selectedAddons = items
      .filter((item) => item.quantity > 0)
      .map((item) => `- ${item.name} (${item.quantity})`)
      .join("\n");

    const eventData = {
      summary: `Booking for ${studio}`,
      location: "Your studio location",
      description: `Customer Name: ${customerName}
Customer Email: ${customerEmail}
Customer Phone: ${customerPhone}
Date: ${formattedDate}
Start Time: ${startTime}
End Time: ${endTime}${updatedBooking.event ? '\nEvent: Yes (Cleaning fee applied)' : '\nEvent: No'}${selectedAddons ? `\nAdd-ons:\n${selectedAddons}` : ""}
Subtotal: $${subtotal}
Studio Cost: $${studioCost}
Estimated Total: $${estimatedTotal}`,
      start: { dateTime: startISO, timeZone: "America/Los_Angeles" },
      end: { dateTime: endISO, timeZone: "America/Los_Angeles" },
    };

    try {
      const calendarEvent = await createCalendarEvent(eventData);
      console.log("✅ Google Calendar event created:", calendarEvent.id);
      await Booking.findByIdAndUpdate(bookingId, {
        calendarEventId: calendarEvent.id,
      });
    } catch (calendarError) {
      console.error(
        "❌ Failed to create Google Calendar event:",
        calendarError.message
      );
    }

    return res.status(200).json({
      message: "Payment verified and booking updated",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}
