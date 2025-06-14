// models/Booking.js
import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema({
  studio: { type: String, required: true },
  startDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  items: { type: Array, default: [] },
  subtotal: { type: Number, default: 0 },
  studioCost: { type: Number, default: 0 },
  cleaningFee: { type: Number, default: 0 },
  estimatedTotal: { type: Number, default: 0 },
  paymentStatus: { type: String, default: "manual" }, // "manual" for direct calendar events
  customerName: { type: String, default: "" },
  customerEmail: { type: String, default: "" },
  customerPhone: { type: String, default: "" },
  event: { type: Boolean, default: false }, // Track if this is an event booking
  calendarEventId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
  // TIMEZONE FIX TRACKING FIELDS
  syncVersion: { type: String, default: null }, // Track which sync version created this
  migrationSafe: { type: Boolean, default: true }, // Mark as safe to modify
  lastSyncUpdate: { type: Date, default: null }, // When was this last updated by sync
  webhookProcessed: { type: Boolean, default: false }, // Track if processed by webhook
  webhookUniqueKey: { type: String, default: null }, // Unique webhook processing key
  originalEventStart: { type: String, default: null }, // Original Google Calendar event start
  originalEventEnd: { type: String, default: null }, // Original Google Calendar event end
  eventTimeZone: { type: String, default: null }, // Event timezone from Google Calendar
  processedWithManualHandler: { type: Boolean, default: false }, // Track if used manual handler
  calendarEventUpdated: { type: String, default: null }, // Google Calendar event updated timestamp
  calendarEventCreated: { type: String, default: null }, // Google Calendar event created timestamp
  lastCleanupUpdate: { type: Date, default: null }, // When was HTML cleaned up
});

export default mongoose.models.Booking ||
  mongoose.model("Booking", BookingSchema);
