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
      cleaningFee,
      estimatedTotal: clientTotal,
      customerName,
      customerEmail,
      customerPhone,
      timestamp,
    } = req.body;

    // 1️⃣ Validate Product Catalog
    const productDoc = await Product.findOne().lean();
    if (!productDoc) {
      return res.status(400).json({ message: "Product catalog not found" });
    }

    // 2️⃣ Validate Studio Selection
    const validStudio = productDoc.studios.find(
      (s) => s.name.toLowerCase() === clientStudio.toLowerCase()
    );
    if (!validStudio) {
      return res.status(400).json({
        message: `Invalid studio: "${clientStudio}" is not available.`,
      });
    }

    // 3️⃣ Validate Add-ons
    const priceMap = {};
    productDoc.services.forEach((service) => {
      priceMap[String(service.id)] = service.pricePerHour;
    });

    let recalculatedSubtotal = 0;
    for (const clientItem of clientItems) {
      const canonicalPrice = priceMap[String(clientItem.id)];
      if (canonicalPrice === undefined) {
        return res.status(400).json({
          message: `Invalid product: ${clientItem.name} (ID: ${clientItem.id}) not found.`,
        });
      }
      recalculatedSubtotal += clientItem.quantity * canonicalPrice;
    }

    if (Number(clientSubtotal) !== recalculatedSubtotal) {
      return res.status(400).json({ message: "Subtotal mismatch" });
    }

    // 4️⃣ Validate Cleaning Fee
    if (![0, 180].includes(cleaningFee)) {
      return res.status(400).json({ message: "Invalid cleaning fee amount." });
    }

    // 5️⃣ Validate Total
    const recalculatedTotal = recalculatedSubtotal + studioCost + cleaningFee;
    if (Number(clientTotal) !== recalculatedTotal) {
      return res.status(400).json({ message: "Total mismatch" });
    }

    // 6️⃣ Save Booking to DB
    const booking = new Booking({
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
    });

    await booking.save();

    // 7️⃣ Create Stripe Customer
    const stripeCustomer = await stripe.customers.create({
      email: customerEmail,
      phone: customerPhone,
      name: customerName,
    });

    // 8️⃣ Build Stripe Line Items
    const validLineItems = clientItems
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
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

    if (cleaningFee > 0) {
      validLineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Cleaning Fee" },
          unit_amount: Math.round(cleaningFee * 100),
        },
        quantity: 1,
      });
    }

    if (validLineItems.length === 0) {
      return res.status(400).json({ message: "No valid items to checkout" });
    }

    // 9️⃣ Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      phone_number_collection: { enabled: true },
      mode: "payment",
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      customer_email: customerEmail,
      line_items: validLineItems,
      metadata: {
        bookingId: booking._id.toString(),
      },
    });

    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    res.status(500).json({
      message: "Error creating checkout session",
      error: error.message,
    });
  }
}
