// pages/cancel.js
import Link from "next/link";

export default function cancel() {
  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Payment Canceled</h1>
      <p>
        Your payment process was canceled. If you wish, you can try booking
        again.
      </p>
      <Link href="/">Return to Booking</Link>
    </div>
  );
}
