import Stripe from "stripe";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import ServiceBooking from "@/models/Service";
import { format } from "date-fns";
import createCalendarEvent, {
  createServiceCalendarEvent,
} from "@/utils/calenderEvent";

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
    console.error(
      "❌ Stripe webhook signature verification failed.",
      err.message
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingType = session.metadata?.type || "studio";

    // Handle service bookings
    if (bookingType === "service") {
      const serviceBookingId = session.metadata?.serviceBookingId;

      if (!serviceBookingId) {
        console.error("❌ No serviceBookingId in session metadata.");
        return res
          .status(400)
          .json({ message: "No serviceBookingId in session metadata" });
      }

      try {
        const updatedServiceBooking = await ServiceBooking.findByIdAndUpdate(
          serviceBookingId,
          { paymentStatus: "success" },
          { new: true }
        );

        if (!updatedServiceBooking) {
          console.error(
            `❌ Service booking not found for ID: ${serviceBookingId}`
          );
          return res.status(404).json({ message: "Service booking not found" });
        }

        console.log(
          `✅ Service booking ${serviceBookingId} marked as success via webhook.`
        );

        // Create Google Calendar event for service booking
        const {
          startDate,
          startTime,
          endTime,
          customerName,
          customerEmail,
          customerPhone,
          services = [],
          subtotal,
          estimatedTotal,
        } = updatedServiceBooking;

        // Only create calendar event if it doesn't already exist
        if (!updatedServiceBooking.calendarEventId) {
          try {
            // Use the user-selected date for Google Calendar
            const calendarDate = new Date(startDate);
            const formattedDate = format(calendarDate, "yyyy-MM-dd");

            // Create DateTime strings with user-selected date
            const startDateTime = `${formattedDate}T${convertTo24Hour(
              startTime
            )}`;
            const endDateTime = `${formattedDate}T${convertTo24Hour(endTime)}`;

            const selectedServices = services
              .filter((service) => service.quantity > 0)
              .map((service) => `- ${service.name} (Qty: ${service.quantity})`)
              .join("\n");

            const eventData = {
              summary: `Service Booking - ${customerName}`,
              location: "Service Location", // You can customize this
              description: `Customer Name: ${customerName}
Customer Email: ${customerEmail}
Customer Phone: ${customerPhone}
Date: ${formattedDate}
Start Time: ${startTime}
End Time: ${endTime}
Services Booked:
${selectedServices}
Subtotal: $${subtotal}
Total: $${estimatedTotal}`,
              start: {
                dateTime: startDateTime,
                timeZone: "America/New_York",
              },
              end: {
                dateTime: endDateTime,
                timeZone: "America/New_York",
              },
            };

            // Create calendar event for service bookings using the service calendar
            const calendarEvent = await createServiceCalendarEvent(eventData);
            console.log(
              "✅ Service calendar event created via webhook:",
              calendarEvent.id
            );

            // Update service booking with calendar event ID
            await ServiceBooking.findByIdAndUpdate(serviceBookingId, {
              calendarEventId: calendarEvent.id,
              syncVersion: "v3.4-service-calendar-synced",
            });

            console.log(
              `✅ Service calendar and database synced via webhook for date: ${formattedDate}`
            );
          } catch (calendarError) {
            console.error(
              "❌ Failed to create service calendar event via webhook:",
              calendarError.message
            );
            // Don't fail the webhook if calendar creation fails
          }
        }

        res.status(200).json({ received: true });
      } catch (error) {
        console.error(
          "❌ Error updating service booking status via webhook:",
          error
        );
        res
          .status(500)
          .json({ message: "Error updating service booking status" });
      }
    }
    // Handle studio bookings (original logic)
    else {
      const bookingId = session.metadata?.bookingId;
      if (!bookingId) {
        console.error("❌ No bookingId in session metadata.");
        return res
          .status(400)
          .json({ message: "No bookingId in session metadata" });
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
            // Use the user-selected date for Google Calendar
            const calendarDate = new Date(startDate);
            const formattedDate = format(calendarDate, "yyyy-MM-dd");

            // Create DateTime strings with user-selected date
            const startDateTime = `${formattedDate}T${convertTo24Hour(
              startTime
            )}`;
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
End Time: ${endTime}${
                isEvent ? "\nEvent: Yes (Cleaning fee applied)" : "\nEvent: No"
              }${selectedAddons ? `\nAdd-ons:\n${selectedAddons}` : ""}
Subtotal: $${subtotal}
Studio Cost: $${studioCost}
Estimated Total: $${estimatedTotal}`,
              start: {
                dateTime: startDateTime,
                timeZone: "America/New_York",
              },
              end: {
                dateTime: endDateTime,
                timeZone: "America/New_York",
              },
            };

            const calendarEvent = await createCalendarEvent(eventData);
            console.log(
              "✅ Google Calendar event created via webhook:",
              calendarEvent.id
            );

            // SYNC FIX: Update database booking to match the EXACT date we sent to Google Calendar
            await Booking.findByIdAndUpdate(bookingId, {
              calendarEventId: calendarEvent.id,
              startDate: calendarDate, // Ensure database matches calendar exactly
              syncVersion: "v3.4-calendar-database-synced",
            });

            console.log(
              `✅ Calendar and database synced via webhook for date: ${formattedDate}`
            );
          } catch (calendarError) {
            console.error(
              "❌ Failed to create Google Calendar event via webhook:",
              calendarError.message
            );
            // Don't fail the webhook if calendar creation fails
          }
        }

        res.status(200).json({ received: true });
      } catch (error) {
        console.error("❌ Error updating booking status via webhook:", error);
        res.status(500).json({ message: "Error updating booking status" });
      }
    }
  } else {
    // Unexpected event type
    res.status(200).json({ received: true });
  }
}
