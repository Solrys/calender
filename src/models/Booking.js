import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema({
  studio: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  items: [
    {
      id: Number,
      name: String,
      price: Number,
      quantity: Number,
      image: String,
    },
  ],
  subtotal: {
    type: Number,
    required: true,
  },
  studioCost: {
    type: Number,
    required: true,
  },
  estimatedTotal: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    default: "pending", // "pending" until payment is verified
  },
  customerName: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,
    required: true,
  },
  customerPhone: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Booking ||
  mongoose.model("Booking", BookingSchema);
