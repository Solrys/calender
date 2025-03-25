import React, { useContext, useState, useEffect } from "react";
import { BookingContext } from "@/context/BookingContext";
import styles from "@/styles/Checkout.module.css";
import { FiBox } from "react-icons/fi";
import { MdCalendarMonth, MdAccessTime, MdLocationOn } from "react-icons/md";
import { loadStripe } from "@stripe/stripe-js";
import { timeStringToMinutes } from "@/utils/bookingHelpers";

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

export default function CheckoutPage() {
  const {
    studio,
    startDate,
    startTime,
    endTime,
    items,
    updateItemQuantity,
    selectedStudio,
  } = useContext(BookingContext);

  // Calculate totals
  const subtotal = items.reduce(
    (acc, item) => acc + item.quantity * item.price,
    0
  );
  const studioHours =
    selectedStudio && startDate && endTime
      ? (timeStringToMinutes(endTime) - timeStringToMinutes(startTime)) / 60
      : 0;
  const studioCost =
    selectedStudio && studioHours > 0
      ? studioHours * selectedStudio.pricePerHour
      : 0;

  const estimatedTotal = subtotal + studioCost;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // State for T&C modal
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  // State for Customer Info form modal
  const [showModal, setShowModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [formError, setFormError] = useState("");

  // On mount, check if the user has already accepted T&C in localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedAcceptance = localStorage.getItem("acceptedTnC");
      if (storedAcceptance === "true") {
        setHasAcceptedTerms(true);
      }
    }
  }, []);

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
      // Store acceptance in localStorage so user won’t see T&C again
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
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studio: selectedStudio.name,
          startDate,
          startTime,
          endTime,
          items,
          subtotal,
          studioCost,
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

  const filteredItems = items.filter((item) => item.quantity > 0);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold text-center mb-6">
        Your Appointment Details
      </h2>

      {/* Studio Details Section */}
      <div className="bg-white p-6 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-[20%,40% 40%, 5%, 5%] gap-4">
          {/* Studio Name */}
          <div className="flex flex-col gap-1">
            <p className="text-gray-600 text-sm font-semibold">Studio Name</p>
            <div className="p-3 flex items-center gap-1 text-[14px] bg-gray-100">
              <MdLocationOn className="mr-1" />
              {selectedStudio
                ? `${
                    selectedStudio.name
                  } ($${selectedStudio.pricePerHour.toFixed(2)}/Hr)`
                : studio}
            </div>
          </div>

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

          {/* Price per Hr */}
          <div className="flex flex-col gap-1">
            <p className="text-gray-600 text-sm font-semibold">Price per Hr</p>
            <div className="p-3 text-[16px] bg-gray-100">
              $
              {selectedStudio ? selectedStudio.pricePerHour.toFixed(2) : "0.00"}
            </div>
          </div>

          {/* Total Price */}
          <div className="flex flex-col gap-1">
            <p className="text-gray-600 text-sm font-semibold">Total Price</p>
            <div className="p-3 text-[16px] bg-gray-100">
              {(() => {
                if (startTime && endTime && selectedStudio) {
                  const startMins = timeStringToMinutes(startTime);
                  const endMins = timeStringToMinutes(endTime);
                  const duration = (endMins - startMins) / 60;
                  const total = selectedStudio.pricePerHour * duration;
                  return `$${total.toFixed(2)}`;
                }
                return "$0.00";
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Addons Section */}
      <div className={styles.addonCard}>
        <div>
          <h3 className="text-lg font-bold mb-4">Your Add Ons</h3>
          {filteredItems.length === 0 ? (
            <p className="text-gray-500 text-sm">No addons to show.</p>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className="flex gap-2 py-2 items-center">
                <p className="flex items-center gap-2 bg-[#f8f8f8] px-4 py-[15.4px] font-semibold text-sm w-full">
                  <FiBox /> {item.name}
                </p>
              </div>
            ))
          )}
        </div>

        <div>
          <div className="grid grid-cols-3 gap-4 font-semibold text-gray-600 mb-4">
            <p className="text-center">Total Hours</p>
            <p className="text-center">Price/Hr</p>
            <p className="text-center">Total Price</p>
          </div>
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-3 gap-4 items-center py-2"
            >
              {/* Quantity Control */}
              <div className="flex items-center justify-center bg-[#f8f8f8] px-4 py-3 font-semibold text-center text-sm w-full">
                <button
                  onClick={() => updateItemQuantity(item.id, -1)}
                  className="text-lg px-2 text-gray-600"
                  disabled={item.quantity <= 1}
                >
                  −
                </button>
                <span className="mx-3">{item.quantity}</span>
                <button
                  onClick={() => updateItemQuantity(item.id, 1)}
                  className="text-lg px-2 text-gray-600"
                >
                  +
                </button>
              </div>

              {/* Price per hour */}
              <p className="flex items-center gap-2 justify-center bg-[#f8f8f8] px-4 py-3 font-semibold text-center text-sm w-full">
                ${item.price}/Hr
              </p>

              {/* Total Price for item */}
              <p className="flex items-center gap-2 justify-center bg-[#f8f8f8] px-4 py-3 font-semibold text-center text-sm w-full">
                ${item.quantity * item.price}
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
            <p>Add Ons</p>
            <p>${subtotal.toFixed(2)}</p>
          </div>
          <div className="flex justify-between">
            <p>Studio Price</p>
            <p>${studioCost.toFixed(2)}</p>
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
                <strong>Welcome to THE SPACES!</strong> By booking and using our
                studio(s), you agree to the following terms and conditions:
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

              <p>
                <strong>3. STUDIO(S) USAGE RULES</strong>
                <br />
                • Please leave the studio(s) in the same condition as you found
                it.
                <br />
                • No smoking, alcohol, or illegal substances are permitted on
                the premises.
                <br />
                • Noise levels must be kept at a reasonable volume to avoid
                disturbances.
                <br />
                • Rentals must adhere to the agreed-upon time; any overtime will
                incur additional fees.
                <br />
                • No glitter, confetti, or powder is allowed for shoots, as
                these materials are extremely difficult to clean.
                <br />
                • If anything is broken, please notify us immediately. It may
                not be a big deal, but we want to be aware.
                <br />
                • Cameras are on at all times. By renting our studio(s), you
                agree to be recorded and held liable for any property damage
                that results from you or your team’s negligence.
                <br />
                • A cleaning fee of $180.00 will be charged if the rented space
                isn't left as found.
                <br />• A fee of $350.00 will be charged for any damages to the
                furniture (dirt or spills).
              </p>

              <p>
                <strong>4. LIABILITY & RESPONSIBILITY</strong>
                <br />
                • Renters assume full responsibility for any injuries, damages,
                or losses that occur during their rental period.
                <br />
                • THE SPACES is not liable for lost, stolen, or damaged personal
                belongings.
                <br />
                • THE SPACES is not responsible for any accidents, injuries, or
                falls, including but not limited to trips or falls on stairs,
                during the rental period. Renters and their guests assume all
                risks associated with accessing the studio(s) spaces.
                <br />
                • Renters and their guests are solely responsible for parking
                and securing their vehicles. THE SPACES is not liable for any
                damage, theft, towing, or loss related to vehicles parked on or
                near the premises.
                <br />• Renters agree to indemnify and hold THE SPACES harmless
                from any claims or damages resulting from their use of the
                space(s).
              </p>

              <p>
                <strong>5. DAMAGES & SECURITY DEPOSIT</strong>
                <br />
                • Renters are responsible for any damage to the studio(s),
                equipment, or property.
                <br />
                • If a security deposit is required, it will be refunded within
                seven days after the rental, provided no damages or violations
                occur.
                <br />• For events and larger productions, a security deposit of
                $1,000 is required.
              </p>

              <p>
                <strong>6. STAFFING & ENTRY ACCESS</strong>
                <br />
                • At least one THE SPACES staff member will be present during
                bookings.
                <br />
                • Renters must follow all entry and exit instructions.
                <br />• Smart lock codes are for Renters only and must not be
                shared.
              </p>

              <p>
                <strong>7. PHOTO & VIDEO RELEASE</strong>
                <br />• THE SPACES may take promotional photos/videos during
                rentals. If you do not wish to be included, please notify us in
                writing.
              </p>

              <p>
                <strong>8. TERMINATION OF USE</strong>
                <br />• THE SPACES reserves the right to terminate a rental
                without refund if any terms of this agreement are violated.
              </p>

              <p>
                <strong>9. GOVERNING LAW</strong>
                <br />• These Terms & Conditions are governed by the laws of
                Florida.
              </p>

              <p>
                By booking with THE SPACES, you acknowledge and agree to these
                Terms & Conditions. Thank you for choosing us for your creative
                and event needs!
              </p>
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
