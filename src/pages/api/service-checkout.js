import Stripe from "stripe";
import { format } from "date-fns";
import dbConnect from "@/lib/dbConnect";
import ServiceBooking from "@/models/Service";
import Product from "@/models/Product";

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

    // 🔒 SECURITY: Fetch authoritative service prices from MongoDB
    const productDoc = await Product.findOne().lean();
    if (!productDoc) {
      return res
        .status(500)
        .json({ message: "Service catalog not found in database" });
    }

    // Create a price map from MongoDB for validation
    const servicePriceMap = {};
    productDoc.services.forEach((service) => {
      servicePriceMap[String(service.id)] = service.pricePerHour;
    });

    // Also include prices from BookingContext (since not all services may be in Product collection yet)
    // This handles items like the new podcast services, additional video editing, etc.
    const contextServicePrices = {
      1: 300, // Makeup
      6: 350, // Photography
      7: 650, // Videography
      8: 250, // Hair
      10: 400, // Models
      11: 500, // Wardrobe
      12: 250, // Assistant/BTS Reels
      13: 2500, // Creative Direction
      14: 500, // Moodboard
      15: 850, // Full-Service Podcast Filming
      16: 1500, // Full-Service Podcast Filming + Editing
      17: 250, // Additional Edited Videos
    };

    // Merge MongoDB prices with context prices (MongoDB takes precedence)
    const authorizedPrices = { ...contextServicePrices, ...servicePriceMap };

    // 🔒 VALIDATE: Check each service against authorized prices
    let recalculatedSubtotal = 0;
    for (const service of services) {
      const serviceId = String(service.id);
      const authorizedPrice = authorizedPrices[serviceId];

      if (authorizedPrice === undefined) {
        return res.status(400).json({
          message: `Invalid service: ${service.name} (ID: ${serviceId})`,
          availableServices: Object.keys(authorizedPrices),
        });
      }

      // Check if client-provided price matches authorized price
      if (Number(service.price) !== authorizedPrice) {
        return res.status(400).json({
          message: `Price tampering detected for ${service.name}`,
          providedPrice: service.price,
          authorizedPrice: authorizedPrice,
          serviceId: serviceId,
        });
      }

      // Calculate using authorized price (not client-provided price)
      const serviceCost = authorizedPrice * service.quantity;
      recalculatedSubtotal += serviceCost;

      console.log(
        `✅ Service ${service.name} (ID: ${serviceId}): authorized_price=${authorizedPrice}, qty=${service.quantity}, cost=${serviceCost}`
      );
    }

    console.log(
      `🔒 VALIDATION: Recalculated subtotal: ${recalculatedSubtotal}, client subtotal: ${subtotal}`
    );

    // Validate subtotal against recalculated amount using authorized prices
    if (Math.abs(recalculatedSubtotal - subtotal) > 0.01) {
      return res.status(400).json({
        message: "Subtotal validation failed - price tampering detected",
        recalculatedSubtotal: recalculatedSubtotal,
        providedSubtotal: subtotal,
        difference: Math.abs(recalculatedSubtotal - subtotal),
        services: services.map((s) => ({
          name: s.name,
          id: s.id,
          providedPrice: s.price,
          authorizedPrice: authorizedPrices[String(s.id)],
          quantity: s.quantity,
        })),
      });
    }

    // Create service booking in database using validated data
    let serviceBooking;
    try {
      // Use recalculated subtotal from authorized prices for security
      serviceBooking = await new ServiceBooking({
        startDate: new Date(startDate),
        startTime,
        endTime,
        services: services.map((service) => ({
          ...service,
          // Ensure we store the authorized price, not client-provided price
          price: authorizedPrices[String(service.id)],
        })),
        subtotal: recalculatedSubtotal, // Use validated subtotal
        estimatedTotal: recalculatedSubtotal, // For services, total equals subtotal
        customerName,
        customerEmail,
        customerPhone,
        paymentStatus: "pending",
        timestamp,
        createdAt: new Date(),
        // Add security tracking
        priceValidated: true,
        validationTimestamp: new Date(),
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

    // Create line items from services using validated prices
    const lineItems = services.map((service) => {
      const serviceId = String(service.id);
      const authorizedPrice = authorizedPrices[serviceId];

      // 🔒 SECURITY: Always use authorized price from our system, never client-provided price
      const unitPrice = authorizedPrice;

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${service.name} Service`,
            description: `Booked for ${formattedDate} from ${startTime} to ${endTime}`,
          },
          unit_amount: Math.round(unitPrice * 100), // Convert to cents using authorized price
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
