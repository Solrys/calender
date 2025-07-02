import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

// Helper function to extract customer details from event description
function extractCustomerDetails(description) {
  if (!description) {
    return {
      customerName: "Unknown Customer",
      customerEmail: "",
      customerPhone: "",
      services: [],
      subtotal: 0,
      estimatedTotal: 0,
    };
  }

  // Extract customer name
  const nameMatch = description.match(/Customer Name:\s*(.+?)(?:\n|$)/i);
  const customerName = nameMatch ? nameMatch[1].trim() : "Unknown Customer";

  // Extract customer email
  const emailMatch = description.match(/Customer Email:\s*(.+?)(?:\n|$)/i);
  const customerEmail = emailMatch ? emailMatch[1].trim() : "";

  // Extract customer phone
  const phoneMatch = description.match(/Customer Phone:\s*(.+?)(?:\n|$)/i);
  const customerPhone = phoneMatch ? phoneMatch[1].trim() : "";

  // Extract services
  const servicesMatch = description.match(
    /Services Booked:\s*\n((?:- .+\n?)+)/i
  );
  let services = [];
  if (servicesMatch) {
    const serviceLines = servicesMatch[1]
      .split("\n")
      .filter((line) => line.trim().startsWith("-"));
    services = serviceLines.map((line) => {
      const serviceText = line.replace("-", "").trim();
      const qtyMatch = serviceText.match(/(.+?)\s*\(Qty:\s*(\d+)\)/);
      if (qtyMatch) {
        return {
          name: qtyMatch[1].trim(),
          quantity: parseInt(qtyMatch[2]),
        };
      } else {
        return {
          name: serviceText,
          quantity: 1,
        };
      }
    });
  }

  // Extract subtotal
  const subtotalMatch = description.match(/Subtotal:\s*\$?(\d+(?:\.\d{2})?)/i);
  const subtotal = subtotalMatch ? parseFloat(subtotalMatch[1]) : 0;

  // Extract total
  const totalMatch = description.match(/Total:\s*\$?(\d+(?:\.\d{2})?)/i);
  const estimatedTotal = totalMatch ? parseFloat(totalMatch[1]) : subtotal;

  return {
    customerName,
    customerEmail,
    customerPhone,
    services,
    subtotal,
    estimatedTotal,
  };
}

// Helper function to convert 24-hour time to 12-hour format
function convertTo12Hour(time24) {
  if (!time24) return "";

  const [hours, minutes] = time24.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${hour12}:${minutes} ${ampm}`;
}

// Main function to create service booking data from calendar event
export async function createServiceBookingFromCalendarEvent(
  event,
  calendarType = "Service Calendar"
) {
  try {
    console.log(
      `🔄 Processing service calendar event: ${event.summary} (${event.id})`
    );

    // Extract start and end times from event
    const startDateTime = parseISO(event.start.dateTime);
    const endDateTime = parseISO(event.end.dateTime);

    // Format start date as YYYY-MM-DD in Eastern Time
    const startDate = formatInTimeZone(
      startDateTime,
      "America/New_York",
      "yyyy-MM-dd"
    );

    // Extract times in 12-hour format
    const startTime = convertTo12Hour(
      formatInTimeZone(startDateTime, "America/New_York", "HH:mm")
    );
    const endTime = convertTo12Hour(
      formatInTimeZone(endDateTime, "America/New_York", "HH:mm")
    );

    console.log(`   📅 Service Date: ${startDate}`);
    console.log(`   🕐 Time: ${startTime} - ${endTime}`);

    // Extract customer details from event description
    const customerDetails = extractCustomerDetails(event.description);

    console.log(`   👤 Customer: ${customerDetails.customerName}`);
    console.log(`   📧 Email: ${customerDetails.customerEmail}`);
    console.log(`   📞 Phone: ${customerDetails.customerPhone}`);
    console.log(
      `   💼 Services: ${customerDetails.services.length} service(s)`
    );

    // Create service booking data object
    const serviceBookingData = {
      startDate: new Date(`${startDate}T12:00:00.000Z`), // Noon UTC to avoid timezone issues
      startTime,
      endTime,
      customerName: customerDetails.customerName,
      customerEmail: customerDetails.customerEmail,
      customerPhone: customerDetails.customerPhone,
      services: customerDetails.services,
      subtotal: customerDetails.subtotal,
      estimatedTotal: customerDetails.estimatedTotal,
      paymentStatus: "success", // Assume payment is successful if event exists in calendar
      calendarEventId: event.id,
      createdAt: new Date(),
      syncVersion: "v3.4-service-calendar-synced",
      bookingType: "service",
      webhookProcessed: true,
      calendarEventUpdated: event.updated,
      calendarEventCreated: event.created,
      calendarType,
    };

    console.log(
      `   ✅ Service booking data prepared for: ${customerDetails.customerName}`
    );

    return serviceBookingData;
  } catch (error) {
    console.error(
      `❌ Error processing service calendar event ${event.id}:`,
      error
    );
    throw new Error(
      `Failed to process service calendar event: ${error.message}`
    );
  }
}

// Function to clean HTML from text (utility for data cleanup)
export function cleanHTMLFromText(text) {
  if (!text) return "";

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return text.trim();
}
