import mongoose from "mongoose";

const ServiceBookingSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  services: { type: Array, default: [] }, // Array of selected services with quantities
  subtotal: { type: Number, default: 0 },
  estimatedTotal: { type: Number, default: 0 },
  paymentStatus: { type: String, default: "pending" }, // "pending", "success", "failed"
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },
  calendarEventId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
  // Service-specific tracking fields
  syncVersion: { type: String, default: "v3.4-service-booking" },
  bookingType: { type: String, default: "service" }, // To distinguish from studio bookings
  timestamp: { type: String, default: null }, // Client timestamp for debugging
});

export default mongoose.models.ServiceBooking ||
  mongoose.model("ServiceBooking", ServiceBookingSchema);
