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
    console.log("➡️ Checkout request received with body:", req.body);

    const {
      studio: clientStudio,
      startDate,
      startTime,
      endDate,
      endTime,
      items: clientItems,
      subtotal: clientSubtotal,
      studioCost,
      estimatedTotal: clientTotal,
      // New customer fields
      customerName,
      customerEmail,
      customerPhone,
      timestamp, // local timestamp sent from frontend
    } = req.body;

    console.log(endDate, endTime, startTime, "studio name");

    // 1️⃣ Validate Product Catalog
    const productDoc = await Product.findOne().lean();
    if (!productDoc) {
      console.error("❌ Product catalog not found.");
      return res.status(400).json({ message: "Product catalog not found" });
    }
    console.log("✅ Product catalog found.");

    // 2️⃣ Validate Studio Selection
    const validStudio = productDoc.studios.find(
      (s) => s.name.toLowerCase() === clientStudio.toLowerCase()
    );
    if (!validStudio) {
      console.error(`❌ Invalid studio: "${clientStudio}" is not in catalog.`);
      return res.status(400).json({
        message: `Invalid studio: "${clientStudio}" is not available.`,
      });
    }
    console.log("✅ Studio validation passed.");

    // 3️⃣ Validate Add-ons
    const priceMap = {};
    productDoc.services.forEach((service) => {
      priceMap[String(service.id)] = service.pricePerHour;
    });

    let recalculatedSubtotal = 0;
    for (const clientItem of clientItems) {
      const canonicalPrice = priceMap[String(clientItem.id)];
      if (canonicalPrice === undefined) {
        console.error(
          `❌ Invalid product: ${clientItem.name} (ID: ${clientItem.id})`
        );
        return res.status(400).json({
          message: `Invalid product: ${clientItem.name} (ID: ${clientItem.id}) not found.`,
        });
      }
      recalculatedSubtotal += clientItem.quantity * canonicalPrice;
    }

    if (Number(clientSubtotal) !== recalculatedSubtotal) {
      console.error(
        `❌ Subtotal mismatch: Expected ${recalculatedSubtotal}, got ${clientSubtotal}`
      );
      return res.status(400).json({ message: "Subtotal mismatch" });
    }
    console.log("✅ Subtotal validation passed.");

    // 4️⃣ Validate Total Calculation
    const recalculatedTotal = recalculatedSubtotal + studioCost;
    if (Number(clientTotal) !== recalculatedTotal) {
      console.error(
        `❌ Total mismatch: Expected ${recalculatedTotal}, got ${clientTotal}`
      );
      return res.status(400).json({ message: "Total mismatch" });
    }
    console.log("✅ Total calculation passed.");

    // 5️⃣ Create Booking in MongoDB with paymentStatus "pending"
    // (This document will be updated later after payment succeeds.)
    const booking = new Booking({
      studio: clientStudio,
      startDate,
      startTime,
      endDate,
      endTime,
      items: clientItems,
      subtotal: recalculatedSubtotal,
      studioCost,
      estimatedTotal: recalculatedTotal,
      paymentStatus: "pending",
      customerName,
      customerEmail,
      customerPhone,
      createdAt: timestamp || new Date(),
    });

    await booking.save();
    console.log("✅ Booking saved in database with ID:", booking._id);

    // 6️⃣ Create a Stripe Customer to prefill email, phone, and name
    const stripeCustomer = await stripe.customers.create({
      email: customerEmail,
      phone: customerPhone,
      name: customerName,
    });

    // 7️⃣ Build valid line items for the Stripe Checkout Session
    const validLineItems = clientItems
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100), // Convert to cents
        },
        quantity: item.quantity,
      }));

    if (studioCost > 0) {
      validLineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Studio Rental" },
          unit_amount: Math.round(studioCost * 100),
        },
        quantity: 1,
      });
    }

    console.log("📦 Stripe Line Items:", validLineItems);

    if (validLineItems.length === 0) {
      console.error("❌ Error: No valid items in checkout session.");
      return res.status(400).json({ message: "No valid items to checkout" });
    }

    // 8️⃣ Create Stripe Checkout Session and pass bookingId in metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      phone_number_collection: {
        enabled: true,
      },

      mode: "payment",
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      // customer: stripeCustomer.id,
      customer_email: customerEmail,
      line_items: validLineItems,
      metadata: {
        bookingId: booking._id.toString(), // Pass the MongoDB booking ID
      },
    });

    console.log("✅ Stripe Checkout Session Created:", session.id);

    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    res.status(500).json({
      message: "Error creating checkout session",
      error: error.message,
    });
  }
}
