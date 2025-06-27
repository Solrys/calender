import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ message: "Missing session ID" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const bookingType = session.metadata?.type || "studio";

    return res.status(200).json({
      type: bookingType,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("❌ Error retrieving session type:", error);
    return res.status(500).json({
      message: "Error retrieving session type",
      error: error.message,
    });
  }
}
