import { google } from "googleapis";
import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";
import { createBookingFromCalendarEvent } from "@/utils/createBookingFromEvent";
import { WebhookDuplicatePrevention, cleanHTMLFromText } from "../webhook-duplicate-prevention";

// MIGRATION SAFETY SETTINGS
const MIGRATION_TIMESTAMP = new Date('2024-06-13T00:00:00Z');
const SYNC_VERSION = 'v2.2-enhanced-webhook';
const SAFE_MODE = true;

// Initialize the duplicate prevention system
const duplicatePrevention = new WebhookDuplicatePrevention();

// Clean up and parse the service account JSON
let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (
    (serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) ||
    (serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'"))
) {
    serviceAccountKey = serviceAccountKey.slice(1, -1);
}
const serviceAccount = JSON.parse(serviceAccountKey);

// Enhanced event processing with duplicate prevention
async function processCalendarEvent(event, calendarType, calendar, calendarId) {
    try {
        // Skip all-day events
        if (!event.start.dateTime) {
            console.log(`⏭️ Skipping all-day event: ${event.summary}`);
            return { action: 'skipped', reason: 'all-day event' };
        }

        const eventDate = new Date(event.start.dateTime);
        console.log(`\n🔍 Processing event: ${event.summary} (${event.id})`);
        console.log(`   📅 Event date: ${event.start.dateTime}`);

        // ENHANCED DUPLICATE DETECTION: Check multiple ways
        const existingBookings = await Booking.find({ calendarEventId: event.id });

        if (existingBookings.length > 0) {
            console.log(`   ⚠️ DUPLICATE DETECTED: ${existingBookings.length} booking(s) already exist for event ${event.id}`);

            // Check for HTML formatting issues in existing bookings
            let htmlIssuesFixed = 0;
            for (const booking of existingBookings) {
                if (booking.customerName && booking.customerName.includes('<')) {
                    const cleanedName = cleanHTMLFromText(booking.customerName);
                    if (cleanedName !== booking.customerName) {
                        await Booking.findByIdAndUpdate(booking._id, {
                            customerName: cleanedName,
                            lastCleanupUpdate: new Date()
                        });
                        console.log(`   🧹 Fixed HTML in existing booking: "${booking.customerName}" → "${cleanedName}"`);
                        htmlIssuesFixed++;
                    }
                }
            }

            if (existingBookings.length > 1) {
                console.log(`   🚨 CRITICAL: Multiple bookings found for same calendar event!`);

                // Keep the oldest, remove the rest
                existingBookings.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                const keepBooking = existingBookings[0];
                const removeBookings = existingBookings.slice(1);

                for (const duplicate of removeBookings) {
                    await Booking.findByIdAndDelete(duplicate._id);
                    console.log(`   🗑️ Removed duplicate: ${duplicate._id}`);
                }

                return {
                    action: 'cleaned_duplicates',
                    kept: keepBooking._id,
                    removed: removeBookings.length,
                    htmlFixed: htmlIssuesFixed
                };
            }

            return {
                action: 'skipped',
                reason: 'already exists',
                htmlFixed: htmlIssuesFixed
            };
        }

        // FINAL SAFETY CHECK: Double-check right before creating
        const finalCheck = await Booking.findOne({ calendarEventId: event.id });
        if (finalCheck) {
            console.log(`   ⚠️ RACE CONDITION PREVENTED: Booking created between checks for ${event.id}`);
            return { action: 'skipped', reason: 'race condition prevented' };
        }

        // CREATE: New booking from calendar event
        console.log(`   ✅ Creating new booking for event ${event.id}`);
        const bookingData = await createBookingFromCalendarEvent(event, calendarType);

        // ENHANCED: Clean HTML from customer name before saving
        if (bookingData.customerName) {
            const originalName = bookingData.customerName;
            bookingData.customerName = cleanHTMLFromText(originalName);

            if (originalName !== bookingData.customerName) {
                console.log(`   🧹 Cleaned HTML from new booking: "${originalName}" → "${bookingData.customerName}"`);
            }
        }

        console.log(`   📋 Booking data: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime}-${bookingData.endTime}`);

        // Add enhanced tracking
        const enhancedBookingData = {
            ...bookingData,
            calendarEventId: event.id,
            syncVersion: SYNC_VERSION,
            migrationSafe: eventDate >= MIGRATION_TIMESTAMP,
            lastSyncUpdate: new Date(),
            webhookProcessed: true
        };

        try {
            const newBooking = await Booking.create(enhancedBookingData);
            console.log(`   ✅ CREATED booking: "${event.summary || 'No title'}" (${event.id})`);
            console.log(`      Database ID: ${newBooking._id}`);

            return {
                action: 'created',
                bookingId: newBooking._id,
                customerName: bookingData.customerName
            };
        } catch (createError) {
            if (createError.code === 11000) {
                console.log(`   ⚠️ DUPLICATE PREVENTED: MongoDB duplicate key error for ${event.id}`);
                return { action: 'skipped', reason: 'mongodb duplicate key' };
            } else {
                console.error(`   ❌ CREATE ERROR: ${createError.message}`);
                throw createError;
            }
        }

    } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);
        return { action: 'error', error: eventError.message };
    }
}

// Enhanced webhook handler
export default async function handler(req, res) {
    await dbConnect();

    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    try {
        console.log("🔔 Received Google Calendar push notification (ENHANCED)");
        console.log(`🛡️ SAFE MODE: ${SAFE_MODE ? 'ENABLED' : 'DISABLED'}`);

        // Get webhook headers
        const resourceId = req.headers['x-goog-resource-id'];
        const resourceState = req.headers['x-goog-resource-state'];
        const channelId = req.headers['x-goog-channel-id'];

        console.log(`📋 Webhook Details: State=${resourceState}, Resource=${resourceId}, Channel=${channelId}`);

        // ENHANCED RATE LIMITING: Check if we should process this webhook
        if (!duplicatePrevention.shouldProcessWebhook(resourceId, resourceState)) {
            return res.status(200).json({
                message: "Webhook rate limited by enhanced system",
                resourceId,
                resourceState
            });
        }

        // Authenticate using the service account
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ["https://www.googleapis.com/auth/calendar"],
        });

        const calendar = google.calendar({
            version: "v3",
            auth,
        });

        // Determine calendar details
        const manualCalendarId = process.env.GOOGLE_CALENDAR_ID;
        const calendarId = manualCalendarId;
        const calendarType = "Manual Booking Calendar";

        console.log(`📅 Processing enhanced webhook for ${calendarType}`);

        // Handle sync notifications
        if (resourceState === 'sync') {
            console.log("🔄 Initial sync notification - no action needed");
            duplicatePrevention.completeWebhookProcessing(resourceId, resourceState);
            return res.status(200).json({ message: "Sync notification received" });
        }

        // ENHANCED PROCESSING: Add delay and get recent events
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        console.log(`📅 Checking for events updated since ${oneDayAgo.toDateString()}`);

        let events = [];
        try {
            const recentRes = await calendar.events.list({
                calendarId,
                updatedMin: oneDayAgo.toISOString(),
                singleEvents: true,
                orderBy: "updated",
                maxResults: 50 // Reduced to prevent overwhelming
            });

            events = recentRes.data.items || [];
            console.log(`📅 Found ${events.length} recently updated events`);
        } catch (calendarError) {
            console.error("❌ Error fetching calendar events:", calendarError);
            duplicatePrevention.completeWebhookProcessing(resourceId, resourceState);
            return res.status(500).json({ message: "Error fetching calendar events" });
        }

        // ENHANCED PROCESSING: Process each event with detailed tracking
        let results = {
            created: 0,
            skipped: 0,
            cleaned: 0,
            errors: 0,
            htmlFixed: 0
        };

        for (const event of events) {
            // Check event-level rate limiting
            if (!duplicatePrevention.shouldProcessWebhook(resourceId, resourceState, event.id)) {
                console.log(`   🚫 Event ${event.id} rate limited`);
                results.skipped++;
                continue;
            }

            const result = await processCalendarEvent(event, calendarType, calendar, calendarId);

            switch (result.action) {
                case 'created':
                    results.created++;
                    break;
                case 'skipped':
                    results.skipped++;
                    break;
                case 'cleaned_duplicates':
                    results.cleaned += result.removed;
                    results.htmlFixed += result.htmlFixed || 0;
                    break;
                case 'error':
                    results.errors++;
                    break;
            }

            if (result.htmlFixed) {
                results.htmlFixed += result.htmlFixed;
            }

            // Mark event processing as complete
            duplicatePrevention.completeWebhookProcessing(resourceId, resourceState, event.id);
        }

        // Complete webhook processing
        duplicatePrevention.completeWebhookProcessing(resourceId, resourceState);

        const message = `Enhanced Webhook: ${results.created} created, ${results.skipped} skipped, ${results.cleaned} duplicates cleaned, ${results.htmlFixed} HTML issues fixed, ${results.errors} errors`;
        console.log(`✅ ${message}`);

        res.status(200).json({
            message,
            results,
            eventsProcessed: events.length,
            calendarType,
            resourceState,
            enhancedProcessing: true,
            migrationTimestamp: MIGRATION_TIMESTAMP.toISOString(),
            safeMode: SAFE_MODE,
            syncVersion: SYNC_VERSION
        });

    } catch (error) {
        console.error("❌ Error in enhanced calendar webhook:", error);

        // Clean up processing flags on error
        const resourceId = req.headers['x-goog-resource-id'];
        const resourceState = req.headers['x-goog-resource-state'];
        duplicatePrevention.completeWebhookProcessing(resourceId, resourceState);

        res.status(500).json({
            message: "Error processing enhanced calendar webhook",
            error: error.message
        });
    }
} 