import React, { useContext, useState } from "react";
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

  // State for modal popup and customer details
  const [showModal, setShowModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [formError, setFormError] = useState("");

  // New checkout function that includes customer info
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
          timestamp: localTimestamp, // Send today's date with local timestamp
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
  console.log(selectedStudio, "selected studio");

  // When Checkout is clicked, open the modal
  const openModal = () => {
    setShowModal(true);
  };

  // Close the modal
  const closeModal = () => {
    setShowModal(false);
    setFormError("");
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold text-center mb-6">
        Your Appointment Details
      </h2>

      {/* Studio Details Section */}
      <div className="bg-white p-6 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <h3 className="text-lg font-bold mb-4">Your Addons</h3>
          {items
            .filter((item) => item.quantity > 0)
            .map((item) => (
              <div key={item.id} className="flex gap-2 py-2 items-center">
                <p className="flex items-center gap-2 bg-[#f8f8f8] px-4 py-[15.4px] font-semibold text-sm w-full">
                  <FiBox /> {item.name}
                </p>
              </div>
            ))}
        </div>

        <div>
          <div className="grid grid-cols-3 gap-4 font-semibold text-gray-600 mb-4">
            <p className="text-center">Total Hours</p>
            <p className="text-center">Price/Hr</p>
            <p className="text-center">Total Price</p>
          </div>

          {items
            .filter((item) => item.quantity > 0)
            .map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-3  gap-4 items-center py-2"
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
            <p>Add ons</p>
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
          onClick={openModal}
          className="bg-black text-white px-6 py-3 text-lg w-full sm:w-auto"
          disabled={loading}
        >
          {loading ? "Processing..." : "Checkout"}
        </button>
      </div>

      {/* Modal Popup */}
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
                  className="w-full border px-3 py-2 "
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
