import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function SuccessPage() {
  const router = useRouter();
  const { session_id } = router.query; // Get session_id from URL

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [bookingType, setBookingType] = useState("studio"); // Default to studio

  useEffect(() => {
    if (!session_id) return;

    async function verifyPayment() {
      try {
        // First, determine the booking type by checking session metadata
        const sessionCheckRes = await fetch(
          `/api/get-session-type?session_id=${session_id}`
        );

        let sessionType = "studio"; // Default fallback
        if (sessionCheckRes.ok) {
          const sessionData = await sessionCheckRes.json();
          sessionType = sessionData.type || "studio";
        } else {
          console.warn("Failed to get session type, defaulting to studio");
        }

        setBookingType(sessionType);

        // Use appropriate verification endpoint based on booking type
        const verifyEndpoint =
          sessionType === "service"
            ? `/api/verify-service-payment?session_id=${session_id}`
            : `/api/verify-payment?session_id=${session_id}`;

        console.log(`🔍 Using verification endpoint: ${verifyEndpoint}`);

        const res = await fetch(verifyEndpoint);
        const data = await res.json();

        if (!res.ok) {
          // If service verification fails, try studio verification as fallback
          if (sessionType === "service" && res.status === 400) {
            console.log(
              "🔄 Service verification failed, trying studio verification as fallback"
            );
            const fallbackRes = await fetch(
              `/api/verify-payment?session_id=${session_id}`
            );
            const fallbackData = await fallbackRes.json();

            if (fallbackRes.ok) {
              setBookingType("studio");
              setStatus("success");
              return;
            }
          }

          throw new Error(data.message || "Payment verification failed");
        }

        setStatus("success");
      } catch (err) {
        console.error("❌ Error verifying payment:", err);
        setStatus("failed");
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    verifyPayment();
  }, [session_id]);

  // Redirect to home page after 4 seconds if payment is successful
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        router.push("/");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  if (loading) {
    return (
      <p className="text-center text-lg font-semibold">Verifying payment...</p>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      {status === "success" ? (
        <div className="bg-green-100 p-6 rounded-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-green-700">
            Payment Successful 🎉
          </h1>
          <p className="mt-2">
            Your{" "}
            {bookingType === "service" ? "service booking" : "studio booking"}{" "}
            has been confirmed!
          </p>
          <p className="mt-1 text-sm text-green-600">
            {bookingType === "service"
              ? "Your service booking has been added to our calendar and you'll receive confirmation details soon."
              : "Your studio booking has been confirmed. Check your email for details."}
          </p>
          <p className="mt-3 text-sm text-gray-600">
            You will be redirected to the home page shortly...
          </p>
        </div>
      ) : (
        <div className="bg-red-100 p-6 rounded-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-700">Payment Failed ❌</h1>
          <p className="mt-2">
            {error || "Something went wrong. Please contact support."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Return to Home
          </button>
        </div>
      )}
    </div>
  );
}
