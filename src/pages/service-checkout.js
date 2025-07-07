import React, { useContext, useState, useEffect } from "react";
import { BookingContext } from "@/context/BookingContext";
import styles from "@/styles/Checkout.module.css";
import { FiBox } from "react-icons/fi";
import { MdCalendarMonth, MdAccessTime } from "react-icons/md";
import { loadStripe } from "@stripe/stripe-js";
import { timeStringToMinutes } from "@/utils/bookingHelpers";
import { useRouter } from "next/router";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

function DateTimeDisplay({
  date,
  time,
  fallbackDate = "Mon (05/12)",
  fallbackTime = "10:00 AM",
}) {
  const displayDate = date ? date.toDateString() : fallbackDate;
  const displayTime = date ? time : fallbackTime;
  return (
    <div className="flex items-center w-full bg-gray-100 px-4 text-black">
      <MdCalendarMonth size={16} className="mr-1 text-gray-500" />
      <span className="text-[15px]">{displayDate}</span>
      <span className="mx-1 text-gray-500">|</span>
      <MdAccessTime size={16} className="mr-1 text-gray-500" />
      <span className="text-[15px]">{displayTime}</span>
    </div>
  );
}

export default function ServiceCheckoutPage() {
  const { startDate, startTime, endTime } = useContext(BookingContext);

  const router = useRouter();

  // Get selected services from localStorage
  const [selectedServices, setSelectedServices] = useState([]);
  const [isClient, setIsClient] = useState(false);

  // State for loading, error, modals, and form data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [formError, setFormError] = useState("");

  // Load selected services on component mount
  useEffect(() => {
    setIsClient(true);
    const storedServices = localStorage.getItem("selectedServices");
    if (storedServices) {
      setSelectedServices(JSON.parse(storedServices));
    }
  }, []);

  // On mount, check if the user has already accepted T&C in localStorage
  useEffect(() => {
    if (isClient) {
      const storedAcceptance = localStorage.getItem("acceptedTnC");
      if (storedAcceptance === "true") {
        setHasAcceptedTerms(true);
      }
    }
  }, [isClient]);

  // Only show services when client is ready to prevent hydration mismatch
  const displayServices = isClient ? selectedServices : [];

  // Calculate totals
  const serviceHours =
    startDate && endTime
      ? (timeStringToMinutes(endTime) - timeStringToMinutes(startTime)) / 60
      : 0;

  const serviceCosts = displayServices.map((service) => ({
    ...service,
    totalCost:
      service.id === 18
        ? service.price * service.quantity // Per-item pricing for Additional Edited Photos
        : service.price * service.quantity * serviceHours, // Per-hour pricing for other services
  }));

  const subtotal = serviceCosts.reduce(
    (acc, service) => acc + service.totalCost,
    0
  );

  const estimatedTotal = subtotal;

  // When Checkout is clicked
  const openTermsOrForm = () => {
    // If user already accepted terms previously, skip T&C and open the form
    if (hasAcceptedTerms) {
      setShowModal(true);
    } else {
      // Otherwise, show the T&C modal first
      setShowTermsModal(true);
    }
  };

  // Close the T&C modal
  const closeTermsModal = () => {
    setShowTermsModal(false);
  };

  // Accept T&C and open the form modal
  const handleAcceptTerms = () => {
    if (!hasAcceptedTerms) {
      // Store acceptance in localStorage so user won't see T&C again
      localStorage.setItem("acceptedTnC", "true");
      setHasAcceptedTerms(true);
    }
    setShowTermsModal(false);
    setShowModal(true);
  };

  // Close the form modal
  const closeModal = () => {
    setShowModal(false);
    setFormError("");
  };

  // Checkout function that includes customer info
  const handleCheckoutWithCustomerInfo = async () => {
    // Basic validation: ensure all fields are filled
    if (!customerName || !customerEmail || !customerPhone) {
      setFormError("All fields are required.");
      return;
    }

    setLoading(true);
    setError("");
    setFormError("");
    const localTimestamp = new Date().toISOString();
    try {
      const res = await fetch("/api/service-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          startTime,
          endTime,
          services: serviceCosts,
          subtotal,
          estimatedTotal,
          // Add new customer fields
          customerName,
          customerEmail,
          customerPhone,
          timestamp: localTimestamp,
        }),
      });

      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.message || "An error occurred during checkout");
      } else {
        const stripe = await stripePromise;
        await stripe.redirectToCheckout({ sessionId: data.sessionId });
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setError("Server error. Please try again later.");
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold text-center mb-6">
        Your Service Booking Details
      </h2>

      {/* Date/Time Details Section */}
      <div className="bg-white p-6 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Working Hours Start */}
          <div className="flex flex-col gap-1">
            <p className="text-gray-600 text-sm font-semibold">
              Working Hours Start
            </p>
            <div className="p-3 text-[16px] bg-gray-100">
              <DateTimeDisplay date={startDate} time={startTime} />
            </div>
          </div>

          {/* Working Hours End */}
          <div className="flex flex-col gap-1">
            <p className="text-gray-600 text-sm font-semibold">
              Working Hours End
            </p>
            <div className="p-3 text-[16px] bg-gray-100">
              <DateTimeDisplay date={startDate} time={endTime} />
            </div>
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className={styles.addonCard}>
        <div>
          <h3 className="text-lg font-bold mb-4">Your Selected Services</h3>
          {displayServices.length === 0 ? (
            <p className="text-gray-500 text-sm">No services selected.</p>
          ) : (
            displayServices.map((service) => (
              <div key={service.id} className="flex gap-2 py-2 items-center">
                <p className="flex items-center gap-2 bg-[#f8f8f8] px-4 py-[15.4px] font-semibold text-sm w-full">
                  <FiBox /> {service.name}
                </p>
              </div>
            ))
          )}
        </div>

        <div>
          <div className="grid grid-cols-3 gap-4 font-semibold text-gray-600 mb-4">
            <p className="text-center">Quantity</p>
            <p className="text-center">Unit Price</p>
            <p className="text-center">Total Price</p>
          </div>
          {displayServices.map((service) => (
            <div
              key={service.id}
              className="grid grid-cols-3 gap-4 items-center py-2"
            >
              {/* Quantity */}
              <p className="flex items-center gap-2 justify-center bg-[#f8f8f8] px-4 py-3 font-semibold text-center text-sm w-full">
                {
                  service.id === 18
                    ? service.quantity // For Additional Edited Photos, show just quantity
                    : service.quantity * serviceHours // For hour-based services, show total hours
                }
              </p>

              {/* Price per unit */}
              <p className="flex items-center gap-2 justify-center bg-[#f8f8f8] px-4 py-3 font-semibold text-center text-sm w-full">
                {
                  service.id === 18
                    ? `$${service.price}` // For Additional Edited Photos, show per-photo price
                    : `$${service.price}/Hr` // For hour-based services, show per-hour price
                }
              </p>

              {/* Total Price for service */}
              <p className="flex items-center gap-2 justify-center bg-[#f8f8f8] px-4 py-3 font-semibold text-center text-sm w-full">
                $
                {
                  service.id === 18
                    ? service.price * service.quantity // Per-item pricing for Additional Edited Photos
                    : service.price * service.quantity * serviceHours // Per-hour pricing for other services
                }
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Price Summary Section */}
      <div className="bg-white p-6 shadow-sm mb-6">
        <h3 className="text-lg font-bold mb-4">Price Summary</h3>
        <div className="flex flex-col gap-2 text-lg">
          <div className="flex justify-between">
            <p>Services Total</p>
            <p>${subtotal.toFixed(2)}</p>
          </div>

          <div className="flex justify-between font-bold text-xl mt-2">
            <p>Total</p>
            <p className="text-black">${estimatedTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Display any error message */}
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      {/* Checkout Button */}
      <div className="flex justify-center">
        <button
          onClick={openTermsOrForm}
          className="bg-black text-white px-6 py-3 text-lg w-full sm:w-auto"
          disabled={loading}
        >
          {loading ? "Processing..." : "Checkout"}
        </button>
      </div>

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black opacity-50"
            onClick={closeTermsModal}
          ></div>
          {/* Modal content */}
          <div className="relative bg-white p-6 shadow-lg z-10 w-11/12 max-w-2xl max-h-[80vh] overflow-auto">
            <h3 className="text-xl font-bold mb-4">Terms & Conditions</h3>
            <div className="text-sm mb-4 space-y-4">
              <p>
                <strong>Welcome to THE SPACES!</strong> By booking our services,
                you agree to the following terms and conditions:
              </p>

              <p>
                <strong>1. BOOKING & PAYMENTS</strong>
                <br />
                • Full payment is required at the time of booking to secure your
                reservation.
                <br />
                • We accept Zelle, ACH payments, and all major credit cards for
                all bookings.
                <br />• Late or incomplete payments may result in cancellation
                of your booking.
              </p>

              <p>
                <strong>2. CANCELLATION POLICY</strong>
                <br />
                <strong>Cancellation Policy:</strong>
                <br />
                • Unfortunately, we do not offer any refunds or credit for
                cancellations. All payments are final.
                <br />
                <strong>Rescheduling Policy:</strong>
                <br />
                • There is no fee or penalty for rescheduling your booking if
                the request is made at least 48 hours in advance.
                <br />• We are unable to accommodate any changes within 48 hours
                of your scheduled booking. Please contact us to reschedule.
              </p>

              {/* Include other terms as needed */}
            </div>

            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="acceptTerms"
                className="mr-2"
                checked={hasAcceptedTerms}
                onChange={(e) => setHasAcceptedTerms(e.target.checked)}
              />
              <label htmlFor="acceptTerms" className="text-sm">
                I have read and agree to the Terms & Conditions.
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeTermsModal}
                className="px-4 py-2 border"
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-black text-white"
                onClick={handleAcceptTerms}
                disabled={!hasAcceptedTerms}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Customer Info */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black opacity-50"
            onClick={closeModal}
          ></div>
          {/* Modal content */}
          <div className="relative bg-white p-6 shadow-lg z-10 w-11/12 max-w-md">
            <h3 className="text-xl font-bold mb-4">Enter Your Details</h3>
            {formError && (
              <p className="text-red-500 text-center mb-2">{formError}</p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCheckoutWithCustomerInfo();
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full border px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border px-3 py-2"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white"
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
