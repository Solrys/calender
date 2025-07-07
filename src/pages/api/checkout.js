// ✅ Rewritten POST /api/checkout (Creates booking after full validation)

import Stripe from "stripe";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import Product from "@/models/Product";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const {
      studio: clientStudio,
      startDate,
      startTime,
      endDate,
      endTime,
      items: clientItems,
      subtotal: clientSubtotal,
      studioCost,
      cleaningFee,
      estimatedTotal: clientTotal,
      customerName,
      customerEmail,
      customerPhone,
      timestamp,
      event,
    } = req.body;

    const productDoc = await Product.findOne().lean();
    if (!productDoc)
      return res.status(400).json({ message: "Product catalog not found" });

    const validStudio = productDoc.studios.find(
      (s) => s.name.toLowerCase() === clientStudio.toLowerCase()
    );
    if (!validStudio)
      return res
        .status(400)
        .json({ message: `Invalid studio: ${clientStudio}` });

    const priceMap = {};
    productDoc.services.forEach((service) => {
      priceMap[String(service.id)] = service.pricePerHour;
    });

    // Also include prices from BookingContext for new services not yet in Product collection
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
      18: 15, // Additional Edited Photos
    };

    // Merge MongoDB prices with context prices (MongoDB takes precedence)
    const authorizedPrices = { ...contextServicePrices, ...priceMap };

    let recalculatedSubtotal = 0;
    for (const item of clientItems) {
      const price = authorizedPrices[String(item.id)];
      if (price === undefined)
        return res.status(400).json({ message: `Invalid item: ${item.name}` });

      // Validate client-provided price matches authorized price
      if (Number(item.price) !== price) {
        return res.status(400).json({
          message: `Price tampering detected for ${item.name}`,
          providedPrice: item.price,
          authorizedPrice: price,
        });
      }

      recalculatedSubtotal += item.quantity * price;
    }

    if (Number(clientSubtotal) !== recalculatedSubtotal)
      return res.status(400).json({ message: "Subtotal mismatch" });

    if (![0, 180].includes(cleaningFee))
      return res.status(400).json({ message: "Invalid cleaning fee" });

    const recalculatedTotal = recalculatedSubtotal + studioCost + cleaningFee;
    if (Number(clientTotal) !== recalculatedTotal)
      return res.status(400).json({ message: "Total mismatch" });

    let booking;
    try {
      booking = await new Booking({
        studio: clientStudio,
        startDate,
        startTime,
        endDate,
        endTime,
        items: clientItems,
        subtotal: recalculatedSubtotal,
        studioCost,
        cleaningFee,
        estimatedTotal: recalculatedTotal,
        paymentStatus: "pending",
        customerName,
        customerEmail,
        customerPhone,
        createdAt: timestamp || new Date(),
        event,
      }).save();
    } catch (err) {
      console.error("❌ Booking save failed:", err);
      return res
        .status(500)
        .json({ message: "Booking save failed", error: err.message });
    }

    const stripeCustomer = await stripe.customers.create({
      email: customerEmail,
      phone: customerPhone,
      name: customerName,
    });

    const lineItems = clientItems
      .filter((i) => i.quantity > 0)
      .map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

    if (studioCost > 0)
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Studio Rental" },
          unit_amount: studioCost * 100,
        },
        quantity: 1,
      });

    if (cleaningFee > 0)
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Cleaning Fee" },
          unit_amount: cleaningFee * 100,
        },
        quantity: 1,
      });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      phone_number_collection: { enabled: true },
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      customer_email: customerEmail,
      line_items: lineItems,
      metadata: { bookingId: booking._id.toString() },
    });

    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error("❌ Checkout error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}
