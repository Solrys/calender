import Stripe from "stripe";
import dbConnect from "@/lib/dbConnect";
import ServiceBooking from "@/models/Service";
import { format } from "date-fns";
import { createServiceCalendarEvent } from "@/utils/calenderEvent";

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

    console.log(`🔍 Verifying service Stripe session: ${session_id}`);
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("✅ Stripe Session Retrieved:", session.id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const serviceBookingId = session.metadata?.serviceBookingId;

    // Debug: Log the session metadata
    console.log(
      "🔍 Session metadata:",
      JSON.stringify(session.metadata, null, 2)
    );

    if (!serviceBookingId) {
      console.error("❌ Session metadata:", session.metadata);

      // Check if this might be an old session or one created with different logic
      if (session.metadata?.type === "service") {
        console.log(
          "🔄 Service session detected but missing serviceBookingId - this might be from old implementation"
        );
      }

      return res.status(400).json({
        message:
          "Missing serviceBookingId in metadata. This session may have been created before the service booking system was fully implemented.",
        sessionMetadata: session.metadata,
        sessionType: session.metadata?.type,
        suggestion:
          "Please create a new service booking to test the complete flow.",
      });
    }

    const updatedServiceBooking = await ServiceBooking.findByIdAndUpdate(
      serviceBookingId,
      { paymentStatus: "success" },
      { new: true }
    );

    if (!updatedServiceBooking) {
      console.error(
        "❌ Service booking not found in DB, skipping calendar event"
      );
      return res.status(404).json({ message: "Service booking not found" });
    }

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

    // Create calendar event if not already created
    if (!updatedServiceBooking.calendarEventId) {
      try {
        // Use the user-selected date for Google Calendar
        const calendarDate = new Date(startDate);
        const formattedDate = format(calendarDate, "yyyy-MM-dd");

        // Create DateTime strings with user-selected date (ISO 8601 format)
        const startDateTime = `${formattedDate}T${convertTo24Hour(
          startTime
        )}:00`;
        const endDateTime = `${formattedDate}T${convertTo24Hour(endTime)}:00`;

        const selectedServices = services
          .filter((service) => service.quantity > 0)
          .map((service) => `- ${service.name} (Qty: ${service.quantity})`)
          .join("\n");

        const eventData = {
          summary: `Service Booking - ${customerName}`,
          location: "Service Location",
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

        const calendarEvent = await createServiceCalendarEvent(eventData);
        console.log("✅ Service calendar event created:", calendarEvent.id);

        // Update service booking with calendar event ID
        await ServiceBooking.findByIdAndUpdate(serviceBookingId, {
          calendarEventId: calendarEvent.id,
          syncVersion: "v3.4-service-calendar-synced",
        });

        console.log(
          `✅ Service calendar and database synced for date: ${formattedDate}`
        );
      } catch (calendarError) {
        console.error(
          "❌ Failed to create service calendar event:",
          calendarError.message
        );
        // Don't fail the verification if calendar creation fails
      }
    }

    return res.status(200).json({
      message: "Service payment verified and booking updated",
      booking: updatedServiceBooking,
      bookingType: "service",
    });
  } catch (error) {
    console.error("❌ Error verifying service payment:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}
