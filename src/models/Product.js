import mongoose from "mongoose";

const StudioSchema = new mongoose.Schema({
  name: { type: String, required: true },
  canBookTogether: { type: Boolean, required: true },
  minBookingHours: { type: Number, required: true, default: 1 },
  openingTime: { type: String, required: true }, // e.g., "08:00"
  closingTime: { type: String, required: true }, // e.g., "21:00"
  bookingInterval: { type: Number, required: true, default: 60 }, // in minutes
  bufferTime: { type: Number, required: true, default: 30 }, // in minutes
  maxBookableDays: { type: Number, required: true, default: 1 },
});

const ServiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  pricePerHour: { type: Number, required: true },
  image: { type: String, required: true },
});

const ProductSchema = new mongoose.Schema({
  studios: [StudioSchema],
  services: [ServiceSchema],
  extensions: {
    pricePerHour: { type: Number, required: true, default: 300 },
    serviceRate: { type: Number, required: true, default: 200 },
  },
});

// Use the collection "product"
export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema, "product");
