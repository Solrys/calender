import React, { createContext, useState } from "react";
import { startOfDay, addDays } from "date-fns";

// Function to get the nearest valid 30‑minute time slot
function getNearestValidTime() {
  const now = new Date();
  const minutes = now.getMinutes();
  const addMinutes = minutes % 30 === 0 ? 30 : 30 - (minutes % 30);
  const rounded = new Date(now.getTime() + addMinutes * 60000);
  const hour = rounded.getHours();
  const minute = rounded.getMinutes();
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const minStr = minute === 0 ? "00" : "30";
  return `${h12}:${minStr} ${ampm}`;
}

// Define the available studios along with their pricing per hour.
export const studiosList = [
  { name: "THE GROUND", pricePerHour: 200 },
  { name: "THE EXTENSION", pricePerHour: 150 },
  { name: "THE LAB", pricePerHour: 150 },
  { name: "BOTH THE LAB & THE EXTENSION FOR EVENTS", pricePerHour: 300 },
  { name: "THE PODCAST ROOM", pricePerHour: 100 },
];

// Create the context
export const BookingContext = createContext();

// Provider component
export function BookingProvider({ children }) {
  // Selected studio is now stored as an object.
  // Default to the first studio (or set to null if you prefer no default).
  const today = startOfDay(new Date());
  const [selectedStudio, setSelectedStudio] = useState(null);
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState(getNearestValidTime());
  const [endTime, setEndTime] = useState("10:00 AM");
  // Placeholder image URL

  // Example "cart items" or add‑on items with images.
  const [items, setItems] = useState([
    {
      id: 6,
      name: "Photography",
      price: 350,
      quantity: 0,
      image: "/service/photography.avif",
    },
    {
      id: 7,
      name: "Videography",
      price: 650,
      quantity: 0,
      image: "/service/videography.jpg",
    },
    {
      id: 8,
      name: "Hair",
      price: 250,
      quantity: 0,
      image: "/service/hair.webp",
    },
    {
      id: 1,
      name: "Makeup",
      price: 300,
      quantity: 0,
      image: "/service/makeup.avif",
    },

    {
      id: 10,
      name: "Models",
      price: 400,
      quantity: 0,
      image: "/service/models.avif",
    },
    {
      id: 11,
      name: "Wardrobe",
      price: 500,
      quantity: 0,
      image: "/service/wardrobe.avif",
    },
    {
      id: 12,
      name: "Assistant/BTS Reels",
      price: 250,
      quantity: 0,
      image: "/service/btsreels.jpg",
    },
    {
      id: 13,
      name: "Creative Direction",
      price: 1500,
      quantity: 0,
      image: "/service/creativedirection.avif",
    },
    {
      id: 14,
      name: "Moodboards",
      price: 500,
      quantity: 0,
      image: "/service/moodboards.jpg",
    },
  ]);

  // Provide a function to update item quantity.
  const updateItemQuantity = (itemId, delta) => {
    console.log(itemId, delta);

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      )
    );
  };

  return (
    <BookingContext.Provider
      value={{
        studiosList,
        selectedStudio,
        setSelectedStudio,
        startDate,
        setStartDate,
        startTime,
        setStartTime,
        endTime,
        setEndTime,
        items,
        updateItemQuantity,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}
