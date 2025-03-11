import React, { useContext } from "react";
import { BookingContext } from "@/context/BookingContext";
import styles from "@/styles/Addon.module.css";
import Image from "next/image";
import { useRouter } from "next/router";

export default function AddOnsPage() {
  const { startDate, startTime, endTime, items, updateItemQuantity } =
    useContext(BookingContext);
  const router = useRouter();

  return (
    <div className={styles.wrapper}>
      {/* Add-On Items */}
      <div className={styles.addonGrid}>
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 mb-3">
            {/* Item Image */}
            <div className="relative w-full aspect-square">
              <Image
                src={item.image}
                alt={item.name}
                fill
                className="object-cover mb-2"
              />
            </div>

            {/* Item Name & Price */}
            <div className="flex justify-between flex-wrap px-2">
              <p className="font-semibold text-sm w-[50%] uppercase">
                {item.name}
              </p>

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
                  <span className="px-4 text-lg font-semibold text-sm">
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
                          alert("Maximum add-on hours for this item is 1.");
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
      <div className="flex justify-center gap-8 mt-6">
        <button
          className={`px-6 py-2 bg-gray-400 text-white ${
            items.some((item) => item.quantity > 0)
              ? "hover:bg-gray-800"
              : "cursor-not-allowed"
          }`}
          disabled={!items.some((item) => item.quantity > 0)}
        >
          Back
        </button>
        <button
          className={`px-6 py-2 bg-black text-white ${
            items.some((item) => item.quantity > 0)
              ? "hover:bg-gray-800"
              : "bg-gray-400 cursor-not-allowed"
          }`}
          disabled={!items.some((item) => item.quantity > 0)}
          onClick={() => router.push("/checkout")}
        >
          Next
        </button>
      </div>
    </div>
  );
}
