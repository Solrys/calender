import Stripe from "stripe";
import { format } from "date-fns";
import dbConnect from "@/lib/dbConnect";
import ServiceBooking from "@/models/Service";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  await dbConnect();

  try {
    const {
      startDate,
      startTime,
      endTime,
      services,
      subtotal,
      estimatedTotal,
      customerName,
      customerEmail,
      customerPhone,
      timestamp,
    } = req.body;

    // Validate required fields
    if (
      !startDate ||
      !startTime ||
      !endTime ||
      !customerName ||
      !customerEmail ||
      !customerPhone
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!services || services.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one service must be selected" });
    }

    // Validate subtotal (basic validation)
    const calculatedSubtotal = services.reduce((acc, service) => {
      const serviceCost = service.totalCost || service.price * service.quantity;
      console.log(
        `Service ${service.name}: price=${service.price}, qty=${service.quantity}, totalCost=${service.totalCost}, calculated=${serviceCost}`
      );
      return acc + serviceCost;
    }, 0);

    console.log(
      `Calculated subtotal: ${calculatedSubtotal}, provided subtotal: ${subtotal}`
    );

    if (Math.abs(calculatedSubtotal - subtotal) > 0.01) {
      return res.status(400).json({
        message: "Subtotal mismatch",
        calculated: calculatedSubtotal,
        provided: subtotal,
        services: services,
      });
    }

    // Create service booking in database first
    let serviceBooking;
    try {
      serviceBooking = await new ServiceBooking({
        startDate: new Date(startDate),
        startTime,
        endTime,
        services,
        subtotal,
        estimatedTotal,
        customerName,
        customerEmail,
        customerPhone,
        paymentStatus: "pending",
        timestamp,
        createdAt: new Date(),
      }).save();

      console.log(
        "✅ Service booking created in database:",
        serviceBooking._id
      );
    } catch (dbError) {
      console.error("❌ Database error:", dbError);
      return res.status(500).json({
        message: "Error saving service booking",
        error: dbError.message,
      });
    }

    // Format date for display
    const formattedDate = startDate
      ? format(new Date(startDate), "MMMM d, yyyy")
      : "";

    // Create line items from services
    const lineItems = services.map((service) => {
      // Use totalCost if available (which includes hours calculation), otherwise use price
      const unitPrice = service.totalCost
        ? service.totalCost / (service.quantity || 1)
        : service.price;

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${service.name} Service`,
            description: `Booked for ${formattedDate} from ${startTime} to ${endTime}`,
          },
          unit_amount: Math.round(unitPrice * 100), // Convert to cents
        },
        quantity: service.quantity || 1,
      };
    });

    // Create a checkout session with service booking ID in metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      customer_email: customerEmail,
      metadata: {
        type: "service",
        serviceBookingId: serviceBooking._id.toString(),
        startDate: startDate ? new Date(startDate).toISOString() : "",
        startTime,
        endTime,
        customerName,
        customerEmail,
        customerPhone,
        timestamp,
      },
    });

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("Service checkout error:", error);
    return res.status(500).json({
      message: "Error creating checkout session",
      error: error.message,
    });
  }
}
