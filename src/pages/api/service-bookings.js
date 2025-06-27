import dbConnect from "@/lib/dbConnect";
import ServiceBooking from "@/models/Service";

export default async function handler(req, res) {
  // Set proper headers
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  try {
    await dbConnect();
  } catch (dbError) {
    console.error("❌ Database connection failed:", dbError);
    return res.status(500).json({
      message: "Database connection failed",
      error: dbError.message,
      bookings: [],
    });
  }

  if (req.method === "GET") {
    try {
      console.log("📥 Fetching service bookings...");
      const serviceBookings = await ServiceBooking.find({}).lean();
      console.log(`📊 Found ${serviceBookings.length} service bookings`);

      // Add bookingType field to distinguish from studio bookings
      const serviceBookingsWithType = serviceBookings.map((booking) => ({
        ...booking,
        _id: booking._id?.toString(), // Ensure _id is a string
        bookingType: "service",
        studio: "Service Booking", // For display purposes
        items: booking.services || [], // Map services to items for compatibility
      }));

      return res.status(200).json({
        bookings: serviceBookingsWithType,
        count: serviceBookingsWithType.length,
      });
    } catch (error) {
      console.error("❌ Error fetching service bookings:", error);
      return res.status(500).json({
        message: "Server error",
        error: error.message,
        bookings: [],
      });
    }
  } else if (req.method === "DELETE") {
    // Handle service booking cancellation
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({
          message: "Missing service booking id",
          success: false,
        });
      }

      const serviceBooking = await ServiceBooking.findById(id);
      if (!serviceBooking) {
        return res.status(404).json({
          message: "Service booking not found",
          success: false,
        });
      }

      // If service booking has a Google Calendar event, attempt to delete it
      if (serviceBooking.calendarEventId) {
        try {
          // Note: You might want to import and use deleteCalendarEvent here
          // For now, just log it
          console.log(
            `🗑️ Should delete service booking calendar event: ${serviceBooking.calendarEventId}`
          );
        } catch (calError) {
          console.error("❌ Error deleting service calendar event:", calError);
          // Continue with booking deletion even if calendar deletion fails
        }
      }

      const deletedServiceBooking = await ServiceBooking.findByIdAndDelete(id);
      if (!deletedServiceBooking) {
        return res.status(404).json({
          message: "Service booking not found",
          success: false,
        });
      }

      console.log(
        `✅ Successfully deleted service booking: ${
          deletedServiceBooking.customerName || "No name"
        }`
      );

      return res.status(200).json({
        message: "Service booking cancelled successfully",
        booking: {
          ...deletedServiceBooking.toObject(),
          _id: deletedServiceBooking._id.toString(),
        },
        success: true,
      });
    } catch (error) {
      console.error("❌ Error cancelling service booking:", error);
      return res.status(500).json({
        message: "Server error",
        error: error.message,
        success: false,
      });
    }
  } else {
    return res.status(405).json({
      message: "Method not allowed",
      allowedMethods: ["GET", "DELETE"],
    });
  }
}
