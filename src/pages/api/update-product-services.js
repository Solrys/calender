/**
 * API Endpoint to Update Product Services in MongoDB
 * 
 * This endpoint updates the services in the Product collection to match
 * the services defined in BookingContext.js
 * 
 * Usage: POST /api/update-product-services
 * Body: { "confirm": true } to actually perform the update
 */

import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  await dbConnect();

  try {
    const { confirm } = req.body;

    // Services from BookingContext.js (updated list)
    const updatedServices = [
      {
        id: 1,
        name: "Makeup",
        pricePerHour: 300,
        image: "/service/makeup.avif",
      },
      {
        id: 6,
        name: "Photography",
        pricePerHour: 350,
        image: "/service/photography.avif",
      },
      {
        id: 7,
        name: "Videography",
        pricePerHour: 650,
        image: "/service/videography.jpg",
      },
      {
        id: 8,
        name: "Hair",
        pricePerHour: 250,
        image: "/service/hair.webp",
      },
      {
        id: 10,
        name: "Models",
        pricePerHour: 400,
        image: "/service/models.avif",
      },
      {
        id: 11,
        name: "Wardrobe",
        pricePerHour: 500,
        image: "/service/wardrobe.avif",
      },
      {
        id: 12,
        name: "Assistant/BTS Reels",
        pricePerHour: 250,
        image: "/service/btsreels.jpg",
      },
      {
        id: 13,
        name: "Creative Direction",
        pricePerHour: 2500,
        image: "/service/creativedirection.avif",
      },
      {
        id: 14,
        name: "Moodboard",
        pricePerHour: 500,
        image: "/service/moodboards.jpg",
      },
      {
        id: 15,
        name: "Podcast Filming Crew",
        pricePerHour: 400,
        image: "/service/podcast_filming.jpg",
      },
      {
        id: 17,
        name: "Additional Edited Videos",
        pricePerHour: 250,
        image: "/service/extra_videography.jpg",
      },
      {
        id: 18,
        name: "Additional Edited Photos",
        pricePerHour: 15,
        image: "/service/additional_photo.jpg",
      },
      {
        id: 19,
        name: "Podcast Editing Episode",
        pricePerHour: 300, // Note: This is per-episode, but stored as pricePerHour for MongoDB schema
        image: "/service/podcast_filming_editing.jpg",
      },
      {
        id: 20,
        name: "Podcast Simple Reels",
        pricePerHour: 125, // Note: This is per-reel, but stored as pricePerHour for MongoDB schema
        image: "/service/btsreels.jpg",
      },
      {
        id: 21,
        name: "Podcast Advanced Reels",
        pricePerHour: 180, // Note: This is per-reel, but stored as pricePerHour for MongoDB schema
        image: "/service/btsreels.jpg",
      },
    ];

    // Find existing product document
    let productDoc = await Product.findOne();

    if (!productDoc) {
      return res.status(404).json({
        message: "Product document not found. Please create one first.",
      });
    }

    if (!confirm) {
      // Preview mode - show what would be updated
      const currentServices = productDoc.services || [];
      
      // Find services that would be added/updated/removed
      const currentServiceIds = new Set(currentServices.map((s) => s.id));
      const newServiceIds = new Set(updatedServices.map((s) => s.id));
      
      const toAdd = updatedServices.filter((s) => !currentServiceIds.has(s.id));
      const toUpdate = updatedServices.filter((s) => {
        const existing = currentServices.find((cs) => cs.id === s.id);
        return existing && (existing.name !== s.name || existing.pricePerHour !== s.pricePerHour);
      });
      const toRemove = currentServices.filter((s) => !newServiceIds.has(s.id));

      return res.status(200).json({
        message: "Preview mode - no changes made",
        preview: {
          currentServicesCount: currentServices.length,
          newServicesCount: updatedServices.length,
          toAdd: toAdd.map((s) => ({ id: s.id, name: s.name, pricePerHour: s.pricePerHour })),
          toUpdate: toUpdate.map((s) => {
            const existing = currentServices.find((cs) => cs.id === s.id);
            return {
              id: s.id,
              name: { from: existing.name, to: s.name },
              pricePerHour: { from: existing.pricePerHour, to: s.pricePerHour },
            };
          }),
          toRemove: toRemove.map((s) => ({ id: s.id, name: s.name })),
        },
        instruction: "Send { confirm: true } in the request body to apply these changes.",
      });
    }

    // Actually update the services
    productDoc.services = updatedServices;
    await productDoc.save();

    return res.status(200).json({
      message: "Product services updated successfully",
      updatedServices: updatedServices.length,
      services: updatedServices.map((s) => ({
        id: s.id,
        name: s.name,
        pricePerHour: s.pricePerHour,
      })),
    });
  } catch (error) {
    console.error("Error updating product services:", error);
    return res.status(500).json({
      message: "Error updating product services",
      error: error.message,
    });
  }
}
