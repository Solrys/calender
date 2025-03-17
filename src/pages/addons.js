import React, { useContext } from "react";
import { BookingContext } from "@/context/BookingContext";
import styles from "@/styles/Addon.module.css";
import Image from "next/image";
import { useRouter } from "next/router";
import { FaInfoCircle } from "react-icons/fa";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";

export default function AddOnsPage() {
  const { startDate, startTime, endTime, items, updateItemQuantity } =
    useContext(BookingContext);
  const router = useRouter();

  return (
    <div className={styles.wrapper}>
      {/* Add-On Items */}
      <h2 className="text-[22px] sm:text-[32px] font-bold text-center">
        Optional add-on services
      </h2>
      <div className={styles.addonGrid}>
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 mb-3">
            {/* Item Image */}
            <div className="relative w-full aspect-square">
              <Image
                src={item.image}
                alt={item.name}
                fill
                className="object-cover"
              />
              <div className="absolute top-0 right-0 m-2 flex flex-col items-end">
                <Tippy content={item.description} placement="top">
                  <span className="bg-white p-1 rounded-full">
                    <FaInfoCircle className="text-xs text-gray-600" />
                  </span>
                </Tippy>
                {/* Overlay element below the tooltip icon */}
              </div>
            </div>

            {/* Item Name & Price with Description Tooltip */}
            <div className="flex justify-between flex-wrap px-2">
              <div className="flex flex-1 items-center space-x-2">
                <p className="font-semibold text-sm uppercase cursor-help whitespace-nowrap">
                  {item.name}
                </p>
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
                  {/* {(item.id === 13 || item.id === 14) && (
                    <Tippy
                      content="The fee is a one time fee and not charged by the hour"
                      placement="top"
                    >
                      <span className="ml-2 inline-block">
                        <FaInfoCircle className="text-xs text-gray-600" />
                      </span>
                    </Tippy>
                  )} */}
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
          onClick={() => router.push("/checkout")}
        >
          Next
        </button>
      </div>
    </div>
  );
}
