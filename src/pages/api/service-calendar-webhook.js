import { google } from "googleapis";
import dbConnect from "@/lib/dbConnect";
import ServiceBooking from "@/models/Service";
import { createServiceBookingFromCalendarEvent } from "@/utils/serviceCalendarEventHandler";

// MIGRATION SAFETY SETTINGS
const MIGRATION_TIMESTAMP = new Date("2024-06-13T00:00:00Z");
const SYNC_VERSION = "v3.4-service-calendar-synced";
const SAFE_MODE = true;

// ENHANCED WEBHOOK RATE LIMITING with event-specific tracking
const webhookProcessingCache = new Map();
const eventProcessingCache = new Map(); // Track individual events
const WEBHOOK_COOLDOWN_MS = 15000; // 15 seconds
const EVENT_COOLDOWN_MS = 30000; // 30 seconds for individual events
const PROCESSING_TIMEOUT_MS = 45000; // 45 seconds max processing time

// Clean up old entries from cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of webhookProcessingCache.entries()) {
    if (
      now - timestamp >
      Math.max(WEBHOOK_COOLDOWN_MS, PROCESSING_TIMEOUT_MS)
    ) {
      webhookProcessingCache.delete(key);
    }
  }
  for (const [key, timestamp] of eventProcessingCache.entries()) {
    if (now - timestamp > EVENT_COOLDOWN_MS) {
      eventProcessingCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

// HTML cleanup utility
function cleanHTMLFromText(text) {
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

// Helper function to detect if an event was created by our system
async function detectSystemCreatedEvent(event) {
  // Method 1a: Check for explicit system markers (highest priority)
  const description = event.description || "";

  if (
    description.includes("SYSTEM_CREATED:") ||
    description.includes("CREATED_BY: service-booking-system") ||
    description.includes("WEBHOOK_IGNORE: true")
  ) {
    return {
      isSystemCreated: true,
      reason: "Event contains explicit system creation markers",
      confidence: "highest",
    };
  }

  // Method 1b: Check extended properties for system markers
  if (event.extendedProperties && event.extendedProperties.private) {
    const privateProps = event.extendedProperties.private;
    if (
      privateProps.systemCreated === "true" ||
      privateProps.webhookIgnore === "true" ||
      privateProps.createdBy === "service-booking-system"
    ) {
      return {
        isSystemCreated: true,
        reason: "Event contains system creation markers in extended properties",
        confidence: "highest",
      };
    }
  }

  // Method 1c: Check event description for system signatures (legacy detection)
  const systemSignatures = [
    "Customer Name:",
    "Customer Email:",
    "Customer Phone:",
    "Services Booked:",
    "Subtotal: $",
    "Total: $",
    "Service Booking -", // Event title pattern
  ];

  const signatureMatches = systemSignatures.filter(
    (signature) =>
      description.includes(signature) ||
      (event.summary || "").includes(signature)
  );

  if (signatureMatches.length >= 3) {
    // If 3+ signatures match, likely our system
    return {
      isSystemCreated: true,
      reason: `Event contains ${
        signatureMatches.length
      } system signatures: ${signatureMatches.slice(0, 2).join(", ")}...`,
      confidence: "high",
    };
  }

  // Method 2: Check for recent service bookings that might have created this event
  const eventStartTime = new Date(event.start.dateTime);
  const recentBookings = await ServiceBooking.find({
    createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }, // Last 10 minutes
    calendarEventId: { $exists: true },
    paymentStatus: "success",
  });

  // Check if any recent booking has similar timing and could have created this event
  for (const booking of recentBookings) {
    const bookingStartTime = new Date(
      `${booking.startDate.toISOString().split("T")[0]}T${convertTo24Hour(
        booking.startTime
      )}`
    );
    const timeDifference = Math.abs(
      eventStartTime.getTime() - bookingStartTime.getTime()
    );

    // If event time matches a recent booking within 5 minutes, likely created by our system
    if (timeDifference < 5 * 60 * 1000) {
      return {
        isSystemCreated: true,
        reason: `Event timing matches recent booking ${booking._id} (${timeDifference}ms difference)`,
        confidence: "medium",
      };
    }
  }

  // Method 3: Check event creator (if available)
  if (event.creator && event.creator.email) {
    const creatorEmail = event.creator.email.toLowerCase();
    // If created by service account or system email
    if (
      creatorEmail.includes("service-account") ||
      creatorEmail.includes("noreply") ||
      creatorEmail === process.env.SYSTEM_EMAIL?.toLowerCase()
    ) {
      return {
        isSystemCreated: true,
        reason: `Created by system email: ${creatorEmail}`,
        confidence: "high",
      };
    }
  }

  return {
    isSystemCreated: false,
    reason: "No system creation indicators found",
    confidence: "high",
  };
}

// Helper function to extract email from event description
function extractEmailFromEvent(event) {
  const description = event.description || "";
  const emailMatch = description.match(/Customer Email:\s*(.+?)(?:\n|$)/i);
  return emailMatch ? emailMatch[1].trim() : null;
}

// Helper function to convert 12-hour time to 24-hour format
function convertTo24Hour(time12h) {
  if (!time12h) return "12:00";

  const [time, modifier] = time12h.split(" ");
  let [hours, minutes] = time.split(":");

  if (hours === "12") {
    hours = "00";
  }

  if (modifier === "PM") {
    hours = parseInt(hours, 10) + 12;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

// Clean up and parse the service account JSON
let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (
  (serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) ||
  (serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'"))
) {
  serviceAccountKey = serviceAccountKey.slice(1, -1);
}
const serviceAccount = JSON.parse(serviceAccountKey);

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    console.log("🔔 Received Service Calendar push notification");

    // Get webhook headers
    const resourceId = req.headers["x-goog-resource-id"];
    const resourceState = req.headers["x-goog-resource-state"];
    const channelId = req.headers["x-goog-channel-id"];

    console.log(
      `📋 Service Webhook Details: State=${resourceState}, Resource=${resourceId}, Channel=${channelId}`
    );

    // ENHANCED RATE LIMITING: Use multiple factors for webhook deduplication
    const webhookKey = `service_${resourceId}_${resourceState}_${channelId}`;
    const processingKey = `processing_${webhookKey}`;
    const now = Date.now();

    // Check if we're currently processing this webhook
    if (webhookProcessingCache.has(processingKey)) {
      const processingStartTime = webhookProcessingCache.get(processingKey);
      const processingDuration = now - processingStartTime;

      if (processingDuration < PROCESSING_TIMEOUT_MS) {
        console.log(
          `🚫 ALREADY PROCESSING: Service webhook ${webhookKey} started ${processingDuration}ms ago`
        );
        return res.status(200).json({
          message: "Service webhook already being processed",
          processingDuration,
        });
      } else {
        console.log(
          `⚠️ PROCESSING TIMEOUT: Cleaning up stale processing flag for service webhook ${webhookKey}`
        );
        webhookProcessingCache.delete(processingKey);
      }
    }

    // Check recent processing history
    if (webhookProcessingCache.has(webhookKey)) {
      const lastProcessed = webhookProcessingCache.get(webhookKey);
      const timeSinceLastProcessed = now - lastProcessed;

      if (timeSinceLastProcessed < WEBHOOK_COOLDOWN_MS) {
        console.log(
          `🚫 RATE LIMITED: Service webhook ${webhookKey} processed ${timeSinceLastProcessed}ms ago`
        );
        return res.status(200).json({
          message: "Service webhook rate limited",
          cooldownRemaining: WEBHOOK_COOLDOWN_MS - timeSinceLastProcessed,
        });
      }
    }

    // Mark as currently processing
    webhookProcessingCache.set(processingKey, now);
    console.log(`🔄 Processing service webhook: ${webhookKey}`);

    // Add processing delay to handle rapid webhook calls
    await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 seconds

    // Handle sync notifications
    if (resourceState === "sync") {
      console.log(
        "🔄 Service calendar initial sync notification - no action needed"
      );
      webhookProcessingCache.delete(processingKey);
      webhookProcessingCache.set(webhookKey, now);
      return res
        .status(200)
        .json({ message: "Service calendar sync notification received" });
    }

    // Authenticate with Google Calendar
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });
    const calendarId = process.env.GOOGLE_CALENDAR_ID_WEBSITE_SERVICE;
    const calendarType = "Service Calendar";

    if (!calendarId) {
      console.error(
        "❌ GOOGLE_CALENDAR_ID_WEBSITE_SERVICE environment variable not set"
      );
      webhookProcessingCache.delete(processingKey);
      return res
        .status(500)
        .json({ message: "Service calendar ID not configured" });
    }

    console.log(`📅 Service Calendar ID: ${calendarId}`);

    // Only get the most recently updated events (last 10 minutes)
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);

    let events = [];
    try {
      console.log(
        `📅 Fetching service events updated since ${tenMinutesAgo.toISOString()} (last 10 minutes only)`
      );

      const recentRes = await calendar.events.list({
        calendarId,
        updatedMin: tenMinutesAgo.toISOString(),
        singleEvents: true,
        orderBy: "updated",
        maxResults: 5, // Only get the 5 most recent events
        timeZone: "America/New_York",
      });

      events = recentRes.data.items || [];
      console.log(
        `📅 Found ${events.length} recently updated service events (last 10 minutes)`
      );

      // ADDITIONAL FILTER: Only process events that were actually created/updated recently
      const veryRecentEvents = events.filter((event) => {
        const eventUpdated = new Date(event.updated);
        const timeSinceUpdate = now - eventUpdated.getTime();
        return timeSinceUpdate < 15 * 60 * 1000; // Only events updated in last 15 minutes
      });

      console.log(
        `📅 Filtered to ${veryRecentEvents.length} very recent service events`
      );
      events = veryRecentEvents;
    } catch (calendarError) {
      console.error(
        "❌ Error fetching service calendar events:",
        calendarError
      );
      webhookProcessingCache.delete(processingKey);
      return res
        .status(500)
        .json({ message: "Error fetching service calendar events" });
    }

    let serviceBookingsCreated = 0;
    let serviceBookingsSkipped = 0;
    let htmlCleaned = 0;
    let errors = [];

    // Process each event with ENHANCED duplicate protection
    for (const event of events) {
      try {
        // Skip all-day events and events without proper time
        if (!event.start?.dateTime) {
          console.log(
            `⏭️ Skipping service event without dateTime: ${event.summary}`
          );
          continue;
        }

        // ENHANCED UNIQUE IDENTIFIER TRACKING
        const eventKey = `service_event_${event.id}`;
        const eventUniqueKey = `${event.id}_${event.updated}`;

        console.log(
          `\n🔍 Processing service event: ${event.summary} (${event.id})`
        );
        console.log(`   📅 Start: ${event.start.dateTime}`);
        console.log(`   📅 End: ${event.end?.dateTime}`);
        console.log(`   🕐 Updated: ${event.updated}`);
        console.log(`   🔑 Unique Key: ${eventUniqueKey}`);

        // STRICT EVENT-LEVEL RATE LIMITING: Prevent processing same event multiple times
        if (eventProcessingCache.has(eventKey)) {
          const lastEventProcessed = eventProcessingCache.get(eventKey);
          const timeSinceEventProcessed = now - lastEventProcessed;

          if (timeSinceEventProcessed < EVENT_COOLDOWN_MS) {
            console.log(
              `   🚫 SERVICE EVENT RATE LIMITED: ${event.id} processed ${timeSinceEventProcessed}ms ago`
            );
            serviceBookingsSkipped++;
            continue;
          }
        }

        // 🔒 ENHANCED DUPLICATE & LOOP PREVENTION

        // Check 1: Calendar event ID already exists in database
        const existingServiceBookings = await ServiceBooking.find({
          calendarEventId: event.id,
        });

        if (existingServiceBookings.length > 0) {
          console.log(
            `   ⚠️ SERVICE DUPLICATE DETECTED: ${existingServiceBookings.length} service booking(s) already exist for event ${event.id}`
          );

          // Clean HTML from existing service bookings if needed
          for (const booking of existingServiceBookings) {
            if (booking.customerName && booking.customerName.includes("<")) {
              const cleanedName = cleanHTMLFromText(booking.customerName);
              if (cleanedName !== booking.customerName) {
                await ServiceBooking.findByIdAndUpdate(booking._id, {
                  customerName: cleanedName,
                  lastCleanupUpdate: new Date(),
                });
                console.log(
                  `   🧹 Fixed HTML in existing service booking: "${booking.customerName}" → "${cleanedName}"`
                );
                htmlCleaned++;
              }
            }
          }

          serviceBookingsSkipped++;
          eventProcessingCache.set(eventKey, now); // Mark event as processed
          continue;
        }

        // Check 2: Detect if this event was created by our own system (to prevent loops)
        const isSystemCreatedEvent = await detectSystemCreatedEvent(event);
        if (isSystemCreatedEvent.isSystemCreated) {
          console.log(
            `   🔄 SYSTEM-CREATED EVENT DETECTED: ${event.id} was created by our system (${isSystemCreatedEvent.reason}), skipping to prevent loop`
          );
          serviceBookingsSkipped++;
          eventProcessingCache.set(eventKey, now); // Mark event as processed
          continue;
        }

        // Check 3: Check for recent bookings with same customer details (potential loop detection)
        const recentSimilarBookings = await ServiceBooking.find({
          customerEmail: { $exists: true },
          createdAt: { $gte: new Date(now - 30 * 60 * 1000) }, // Last 30 minutes
        });

        const extractedCustomerEmail = extractEmailFromEvent(event);
        if (extractedCustomerEmail) {
          const duplicateByEmail = recentSimilarBookings.find(
            (booking) =>
              booking.customerEmail.toLowerCase() ===
              extractedCustomerEmail.toLowerCase()
          );

          if (duplicateByEmail) {
            console.log(
              `   ⚠️ POTENTIAL LOOP DETECTED: Recent booking found for email ${extractedCustomerEmail} within 30 minutes, skipping`
            );
            serviceBookingsSkipped++;
            eventProcessingCache.set(eventKey, now);
            continue;
          }
        }

        // ADDITIONAL CHECK: Skip if event is too old (created more than 1 hour ago)
        const eventCreated = new Date(event.created);
        const timeSinceCreated = now - eventCreated.getTime();
        if (timeSinceCreated > 60 * 60 * 1000) {
          // 1 hour
          console.log(
            `   ⏭️ Skipping old service event: Created ${Math.round(
              timeSinceCreated / (60 * 1000)
            )} minutes ago`
          );
          continue;
        }

        // Create service booking using the SERVICE CALENDAR EVENT HANDLER
        console.log(
          `   ✅ Creating new service booking for event ${event.id} using SERVICE HANDLER`
        );

        // Use the new service calendar event handler for proper processing
        const serviceBookingData = await createServiceBookingFromCalendarEvent(
          event,
          calendarType
        );

        console.log(
          `   📋 Service booking data: ${
            serviceBookingData.customerName || "No name"
          } - Services: ${serviceBookingData.services.length} - ${
            serviceBookingData.startTime
          } to ${serviceBookingData.endTime}`
        );

        // Add enhanced tracking with unique identifiers
        const enhancedServiceBookingData = {
          ...serviceBookingData,
          calendarEventId: event.id,
          calendarEventUpdated: event.updated,
          calendarEventCreated: event.created,
          syncVersion: SYNC_VERSION,
          migrationSafe: new Date(event.start.dateTime) >= MIGRATION_TIMESTAMP,
          lastSyncUpdate: new Date(),
          webhookProcessed: true,
          webhookUniqueKey: eventUniqueKey,
        };

        // FINAL RACE CONDITION CHECK before creation
        const finalCheck = await ServiceBooking.findOne({
          calendarEventId: event.id,
        });
        if (finalCheck) {
          console.log(
            `   ⚠️ RACE CONDITION PREVENTED: Service booking created during processing`
          );
          serviceBookingsSkipped++;
          eventProcessingCache.set(eventKey, now);
          continue;
        }

        const newServiceBooking = await ServiceBooking.create(
          enhancedServiceBookingData
        );
        console.log(
          `   ✅ SERVICE BOOKING CREATED: ${
            newServiceBooking.customerName || "No name"
          } - ${newServiceBooking.startTime} to ${newServiceBooking.endTime}`
        );
        console.log(`      Database ID: ${newServiceBooking._id}`);
        console.log(
          `      Calendar Event ID: ${newServiceBooking.calendarEventId}`
        );
        serviceBookingsCreated++;
        eventProcessingCache.set(eventKey, now); // Mark event as processed
      } catch (eventError) {
        console.error(
          `❌ Error processing service event ${event.id}:`,
          eventError
        );
        errors.push(`Service Event ${event.id}: ${eventError.message}`);
      }
    }

    // Clean up processing flag and set completion timestamp
    webhookProcessingCache.delete(processingKey);
    webhookProcessingCache.set(webhookKey, now);

    const message = `Service Calendar Webhook: ${serviceBookingsCreated} created, ${serviceBookingsSkipped} skipped, ${htmlCleaned} HTML cleaned${
      errors.length > 0 ? `, ${errors.length} errors` : ""
    }`;
    console.log(`✅ ${message}`);

    res.status(200).json({
      message,
      eventsProcessed: events.length,
      serviceBookingsCreated,
      serviceBookingsSkipped,
      htmlCleaned,
      errors: errors.length > 0 ? errors : undefined,
      processingTimeMs: Date.now() - now,
      calendarType,
      calendarId,
      resourceState,
      safeMode: SAFE_MODE,
      syncVersion: SYNC_VERSION,
      webhookType: "service-calendar",
    });
  } catch (error) {
    console.error("❌ Error in service calendar webhook:", error);

    // Clean up processing flag on error
    const errorProcessingKey = `processing_service_${req.headers["x-goog-resource-id"]}_${req.headers["x-goog-resource-state"]}_${req.headers["x-goog-channel-id"]}`;
    webhookProcessingCache.delete(errorProcessingKey);

    res.status(500).json({
      message: "Error processing service calendar webhook",
      error: error.message,
      webhookType: "service-calendar",
    });
  }
}
