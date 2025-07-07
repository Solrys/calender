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
  { name: "THE GROUND", pricePerHour: 225 },
  { name: "THE EXTENSION", pricePerHour: 150 },
  { name: "THE LAB", pricePerHour: 150 },
  { name: "BOTH THE LAB & THE EXTENSION", pricePerHour: 300 },
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
  const [event, setEvent] = useState(null);
  // Placeholder image URL

  // Example "cart items" or add‑on items with images.
  const [items, setItems] = useState([
    {
      id: 6,
      name: "Photography",
      price: 350,
      quantity: 0,
      image: "/service/photography.avif",
      description:
        "Work with our in-house photographers for a seamless, high-quality shoot. Includes 30 professionally edited images. Access to all raw photos and additional edits are available for a fee. Full lighting setup and other photography essentials included.",
    },
    {
      id: 7,
      name: "Videography",
      price: 650,
      quantity: 0,
      image: "/service/videography.jpg",
      description:
        "Work with our in-house videographers to create high-end visual content. Includes a full shoot and professionally edited footage tailored to your needs. Lighting and all necessary equipment are provided to ensure a flawless production.",
    },
    {
      id: 8,
      name: "Hair",
      price: 250,
      quantity: 0,
      image: "/service/hair.webp",
      description:
        "Our expert in-house hairstylists specialize in crafting stunning looks tailored to your needs. Whether for a photoshoot, video content, or a major event, they'll ensure your hair is styled to perfection.",
    },
    {
      id: 1,
      name: "Makeup",
      price: 300,
      quantity: 0,
      image: "/service/makeup.avif",
      description:
        "Our highly skilled in-house makeup artists are ready to bring your vision to life, whether it's for a shoot, video, or a special event. From natural glam to bold editorial looks, they've got you covered.",
    },
    {
      id: 10,
      name: "Models",
      price: 400,
      quantity: 0,
      image: "/service/models.avif",
      description:
        "Gain access to top-tier models through our agency partners. Choose models whose look and energy align with your production's creative direction, ensuring the perfect fit for your shoot or event.",
    },
    {
      id: 11,
      name: "Wardrobe",
      price: 500,
      quantity: 0,
      image: "/service/wardrobe.avif",
      description:
        "Work with our in-house wardrobe stylists, trained by renowned celebrity stylist Sarah Akiba, known for curating looks for some of the biggest names in the music industry. Gain exclusive access to her extensive wardrobe archive, with custom-styled looks designed to elevate your production. This service includes three expertly curated wardrobe changes. Send us your inspiration, and we will bring your vision to life with a look tailored just for you.",
    },
    {
      id: 12,
      name: "Assistant/BTS Reels",
      price: 250,
      quantity: 0,
      image: "/service/btsreels.jpg",
      description:
        "Need an extra set of hands? Our trained production assistants provide on-set support while also capturing authentic behind-the-scenes (BTS) content for social media. Get high-quality iPhone footage optimized for platforms like Instagram Reels and TikTok. Includes 1 edited reel per hour booked.",
    },
    {
      id: 13,
      name: "Creative Direction",
      price: 2500,
      quantity: 0,
      image: "/service/creativedirection.avif",
      description:
        "Collaborate with Sarah Akiba, a renowned celebrity stylist and creative director behind major campaigns like J Balvin x Jordan and an extensive portfolio of high-profile brand collaborations. She provides comprehensive production services, including concept development, set design, on-set direction, and seamless execution—bringing your creative vision to life with precision and style.",
    },
    {
      id: 14,
      name: "Moodboard",
      price: 500,
      quantity: 0,
      image: "/service/moodboards.jpg",
      description:
        "A carefully curated visual guide designed to capture your project's essence. Our moodboard ensures a cohesive aesthetic, providing a clear roadmap for your team to achieve a flawlessly executed production or event.",
    },
    {
      id: 15,
      name: "Full-Service Podcast Filming (4 HR INCLUDED)",
      price: 850,
      quantity: 0,
      image: "/service/podcast_filming.jpg",
      description:
        "Our in-house podcast producer runs the show—just walk in, and we'll handle the rest. Equipped with professional-grade cameras, crystal-clear sound systems, and full lighting kits; including a 300-watt key light with a large lantern modifier, backlight kickers, C-stand, dual light stands, and real-time monitors, everything is ready to go. This includes set-up and break-down time.",
    },
    {
      id: 16,
      name: "Full-Service Podcast Filming + Editing",
      price: 1500,
      quantity: 0,
      image: "/service/podcast_filming_editing.jpg",
      description:
        "Our in-house podcast producer runs the show—just walk in, and we'll handle the rest. Equipped with professional-grade cameras, crystal-clear sound systems, and full lighting kits; including a 300-watt key light with a large lantern modifier, backlight kickers, C-stand, dual light stands, and real-time monitors, everything is ready to go. This includes set-up and break-down time. After filming, our team handles Post-Production Editing—Cutting, mixing, color-correcting, and optimizing your episode for all platforms. From shoot to final export, we've got you covered.",
    },
    {
      id: 17,
      name: "Additional Edited Videos",
      price: 250,
      quantity: 0,
      image: "/service/extra_videography.jpg",
      description:
        "In addition to our in-house videography service that delivers high-end visual content using full shoot setup with professional lighting and all necessary production equipment, you may add extra content - such as edited videos or reels for $250 per hour of work. The number of deliverables may vary based on the scope of hours requested.",
    },
    {
      id: 18,
      name: "Additional Edited Photos",
      price: 15,
      quantity: 0,
      image: "/service/additional_photo.jpg",
      description:
        "In addition to our in-house photography service, which is complete with full lighting set up and all essential equipment, you may add extra high-quality professionally edited photos for $15 each.",
    },
  ]);
  const cleaningFee = event ? 180 : 0;
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
        event,
        setEvent,
        cleaningFee,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}
