import Stripe from "stripe";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";

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