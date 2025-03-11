import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { items, studioCost, estimatedTotal } = req.body;

      // Convert items into Stripe's format
      const line_items = items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100), // Convert to cents
        },
        quantity: item.quantity,
      }));

      // Add studio price as a separate line item
      if (studioCost > 0) {
        line_items.push({
          price_data: {
            currency: "usd",
            product_data: { name: "Studio Rental" },
            unit_amount: Math.round(studioCost * 100),
          },
          quantity: 1,
        });
      }

      // Create a Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/cancel`,
        line_items,
      });

      res.status(200).json({ sessionId: session.id });
    } catch (err) {
      res.status(500).json({ message: "Error creating checkout session" });
    }
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}
