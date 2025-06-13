import Stripe from "stripe";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import { format, addDays } from "date-fns";
import createCalendarEvent from "@/utils/calenderEvent";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false, // Stripe requires the raw body
  },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

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
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await dbConnect();

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Stripe webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      console.error("❌ No bookingId in session metadata.");
      return res.status(400).json({ message: "No bookingId in session metadata" });
    }
    try {
      const updatedBooking = await Booking.findByIdAndUpdate(
        bookingId,
        { paymentStatus: "success" },
        { new: true }
      );
      if (!updatedBooking) {
        console.error(`❌ Booking not found for ID: ${bookingId}`);
        return res.status(404).json({ message: "Booking not found" });
      }
      console.log(`✅ Booking ${bookingId} marked as success via webhook.`);

      // CRITICAL FIX: Create Google Calendar event after successful payment
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
        event: isEvent,
      } = updatedBooking;

      // Only create calendar event if it doesn't already exist
      if (!updatedBooking.calendarEventId) {
        try {
          // FIX: Apply +1 day correction to match Google Calendar exactly (same as verify-payment.js)
          const correctedDate = addDays(new Date(startDate), 1);
          const formattedDate = format(correctedDate, "yyyy-MM-dd");

          // Create DateTime strings with corrected date
          const startDateTime = `${formattedDate}T${convertTo24Hour(startTime)}`;
          const endDateTime = `${formattedDate}T${convertTo24Hour(endTime)}`;

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
End Time: ${endTime}${isEvent ? '\nEvent: Yes (Cleaning fee applied)' : '\nEvent: No'}${selectedAddons ? `\nAdd-ons:\n${selectedAddons}` : ""}
Subtotal: $${subtotal}
Studio Cost: $${studioCost}
Estimated Total: $${estimatedTotal}`,
            start: {
              dateTime: startDateTime,
              timeZone: "America/New_York"
            },
            end: {
              dateTime: endDateTime,
              timeZone: "America/New_York"
            },
          };

          const calendarEvent = await createCalendarEvent(eventData);
          console.log("✅ Google Calendar event created via webhook:", calendarEvent.id);

          // ALSO UPDATE: Apply +1 day correction to database booking to match calendar
          await Booking.findByIdAndUpdate(bookingId, {
            calendarEventId: calendarEvent.id,
            startDate: correctedDate,
            syncVersion: 'v3.2-new-booking-corrected'
          });

          console.log(`✅ Database booking date corrected via webhook: ${format(new Date(startDate), "yyyy-MM-dd")} → ${formattedDate}`);
        } catch (calendarError) {
          console.error("❌ Failed to create Google Calendar event via webhook:", calendarError.message);
          // Don't fail the webhook if calendar creation fails
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("❌ Error updating booking status via webhook:", error);
      res.status(500).json({ message: "Error updating booking status" });
    }
  } else {
    // Unexpected event type
    res.status(200).json({ received: true });
  }
} 