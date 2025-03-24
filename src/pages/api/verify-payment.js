import Stripe from "stripe";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import { format } from "date-fns";
import createCalendarEvent from "@/utils/calenderEvent";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper: Convert 12-hour format to 24-hour format string "HH:MM:SS"
function convertTo24Hour(timeStr) {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier.toUpperCase() === "PM" && hours !== 12) {
    hours += 12;
  }
  if (modifier.toUpperCase() === "AM" && hours === 12) {
    hours = 0;
  }
  const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hoursStr}:${minutesStr}:00`;
}

// Helper to create Google Calendar event

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ message: "Missing session ID" });
    }

    console.log(`🔍 Verifying Stripe session: ${session_id}`);

    // Retrieve Stripe session details
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("✅ Stripe Session Retrieved:", session);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    // Extract booking ID from metadata
    const bookingId = session.metadata.bookingId;
    if (!bookingId) {
      return res
        .status(400)
        .json({ message: "Booking ID missing from session metadata" });
    }

    // Update the booking status to "success"
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { paymentStatus: "success" },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    console.log(`✅ Booking ${bookingId} marked as success`);

    // Destructure necessary details from the booking document
    const {
      studio,
      startDate,
      startTime,
      endTime,
      customerName,
      customerEmail,
      customerPhone,
    } = updatedBooking;

    // Format startDate to get just the date portion (YYYY-MM-DD)
    const formattedDate = format(new Date(startDate), "yyyy-MM-dd");

    // Build start and end ISO strings with the Eastern Time offset:
    const startISO = new Date(
      formattedDate + "T" + convertTo24Hour(startTime) + "-04:00"
    ).toISOString();
    const endISO = new Date(
      formattedDate + "T" + convertTo24Hour(endTime) + "-04:00"
    ).toISOString();

    const eventData = {
      summary: `Booking for ${studio}`,
      location: "Your studio location",
      description: `Booking details:
Date: ${formattedDate}
Start: ${startTime}
End: ${endTime}
Customer: ${customerName} (${customerEmail})`,
      start: {
        dateTime: startISO,
        timeZone: "America/New_York",
      },
      end: {
        dateTime: endISO,
        timeZone: "America/New_York",
      },
      phone: customerPhone,
    };
    try {
      const calendarEvent = await createCalendarEvent(eventData);
      console.log("✅ Google Calendar event created:", calendarEvent.id);
      await Booking.findByIdAndUpdate(bookingId, {
        calendarEventId: calendarEvent.id,
      });
    } catch (calError) {
      console.error("❌ Error creating calendar event:", calError);
      // Optionally handle calendar event errors here
    }

    res.status(200).json({
      message: "Payment verified and booking updated",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
}
