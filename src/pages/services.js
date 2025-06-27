import React, { useContext } from "react";
import { BookingContext } from "@/context/BookingContext";
import styles from "@/styles/Addon.module.css";
import Image from "next/image";
import { useRouter } from "next/router";
import { MdInfoOutline } from "react-icons/md";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";

export default function ServicesPage() {
  const { items, updateItemQuantity } = useContext(BookingContext);
  const router = useRouter();

  // Proceed to service checkout (requires at least one service selected)
  const handleProceedToCheckout = () => {
    // Check if any service is selected
    const selectedServices = items.filter((item) => item.quantity > 0);

    if (selectedServices.length === 0) {
      alert("Please select at least one service to continue.");
      return;
    }

    // Store selected services in localStorage for checkout
    localStorage.setItem("selectedServices", JSON.stringify(selectedServices));

    // Navigate to service checkout
    router.push("/service-checkout");
  };

  return (
    <div className={styles.wrapper}>
      {/* Service Items */}
      <h2 className="text-[22px] sm:text-[32px] font-bold text-center">
        Select Services
      </h2>
      <div className={styles.addonGrid}>
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 mb-3">
            {/* Service Image */}
            <div className="relative w-full aspect-square">
              <Image
                src={item.image}
                alt={item.name}
                fill
                className="object-cover"
              />
            </div>

            {/* Service Name & Price with Description Tooltip */}
            <div className="flex justify-between flex-wrap px-2">
              <div className="flex flex-1 items-center space-x-2">
                <p className="font-semibold text-sm uppercase cursor-help whitespace-nowrap">
                  {item.name}
                </p>
                <Tippy content={item.description} placement="top">
                  <span className="bg-white p-[2px] rounded-full">
                    <MdInfoOutline size={20} className="text-xs text-black" />
                  </span>
                </Tippy>
              </div>

              {/* Quantity Controls */}
              <div className="flex gap-2 items-center">
                <p className="text-gray-600 font-bold text-sm">
                  {item.id === 13 || item.id === 14
                    ? `$${item.price}`
                    : `$${item.price}/Hr`}
                </p>
                <div className="flex items-center justify-center gap-1">
                  <button
                    className={`w-6 h-6 flex items-center justify-center text-sm ${
                      item.quantity === 0
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-gray-200 hover:bg-gray-300"
                    }`}
                    onClick={() => updateItemQuantity(item.id, -1)}
                    disabled={item.quantity === 0}
                  >
                    −
                  </button>
                  <span className="px-4 font-semibold text-sm">
                    {item.quantity}
                  </span>
                  <button
                    className={`w-6 h-6 flex items-center justify-center text-sm ${
                      item.id === 13 || item.id === 14
                        ? item.quantity >= 1
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-black text-white hover:bg-gray-800"
                        : "bg-black text-white hover:bg-gray-800"
                    }`}
                    onClick={() => {
                      if (item.id === 13 || item.id === 14) {
                        if (item.quantity < 1) {
                          updateItemQuantity(item.id, 1);
                        } else {
                          alert("Maximum quantity for this item is 1.");
                        }
                      } else {
                        updateItemQuantity(item.id, 1);
                      }
                    }}
                    disabled={
                      item.id === 13 || item.id === 14
                        ? item.quantity >= 1
                        : false
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-center gap-8 mt-6 flex-wrap">
        <button
          className={`px-6 py-2 border text-black bg-transparent hover:bg-gray-800 hover:text-white`}
          onClick={() => router.push("/")}
        >
          Back
        </button>
        <button
          className={`px-6 py-2 bg-black text-white hover:bg-gray-800`}
          onClick={handleProceedToCheckout}
        >
          Next
        </button>
      </div>
    </div>
  );
}
