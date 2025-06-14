const mongoose = require('mongoose');

// Load environment variables
function loadEnv() {
    const env = {};
    if (process.env.NODE_ENV !== 'production') {
        const fs = require('fs');
        const possiblePaths = ['.env', '.env.local'];

        for (const envPath of possiblePaths) {
            if (fs.existsSync(envPath)) {
                console.log(`📄 Loading environment from: ${envPath}`);
                const envContent = fs.readFileSync(envPath, 'utf8');
                envContent.split('\n').forEach(line => {
                    const [key, ...valueParts] = line.split('=');
                    if (key && valueParts.length > 0) {
                        env[key.trim()] = valueParts.join('=').trim();
                    }
                });
                break;
            }
        }
    }
    return { ...process.env, ...env };
}

const env = loadEnv();

// Booking Schema
const BookingSchema = new mongoose.Schema({
    studio: { type: String, required: true },
    startDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    customerName: { type: String, default: "" },
    customerEmail: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    paymentStatus: { type: String, default: "manual" },
    calendarEventId: { type: String, unique: true, sparse: true },
    createdAt: { type: Date, default: Date.now },
    syncVersion: { type: String, default: null },
});

const Booking = mongoose.model('Booking', BookingSchema);

// Enhanced webhook duplicate prevention system
class WebhookDuplicatePrevention {
    constructor() {
        // In-memory cache for webhook processing
        this.processingCache = new Map();
        this.COOLDOWN_MS = 10000; // 10 seconds cooldown
        this.MAX_RETRIES = 3;

        // Clean up old entries periodically
        setInterval(() => {
            this.cleanupCache();
        }, 30000); // Clean every 30 seconds
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, data] of this.processingCache.entries()) {
            if (now - data.timestamp > this.COOLDOWN_MS) {
                this.processingCache.delete(key);
            }
        }
    }

    // Check if webhook should be processed
    shouldProcessWebhook(resourceId, resourceState, eventId = null) {
        const webhookKey = `${resourceId}_${resourceState}`;
        const eventKey = eventId ? `event_${eventId}` : null;
        const now = Date.now();

        // Check webhook-level rate limiting
        if (this.processingCache.has(webhookKey)) {
            const data = this.processingCache.get(webhookKey);
            const timeSinceLastProcessed = now - data.timestamp;

            if (timeSinceLastProcessed < this.COOLDOWN_MS) {
                console.log(`🚫 WEBHOOK RATE LIMITED: ${webhookKey} processed ${timeSinceLastProcessed}ms ago`);
                return false;
            }
        }

        // Check event-level processing
        if (eventKey && this.processingCache.has(eventKey)) {
            const data = this.processingCache.get(eventKey);
            const timeSinceLastProcessed = now - data.timestamp;

            if (timeSinceLastProcessed < this.COOLDOWN_MS) {
                console.log(`🚫 EVENT RATE LIMITED: ${eventKey} processed ${timeSinceLastProcessed}ms ago`);
                return false;
            }
        }

        // Mark as being processed
        this.processingCache.set(webhookKey, { timestamp: now, processing: true });
        if (eventKey) {
            this.processingCache.set(eventKey, { timestamp: now, processing: true });
        }

        return true;
    }

    // Mark webhook processing as complete
    completeWebhookProcessing(resourceId, resourceState, eventId = null) {
        const webhookKey = `${resourceId}_${resourceState}`;
        const eventKey = eventId ? `event_${eventId}` : null;

        if (this.processingCache.has(webhookKey)) {
            const data = this.processingCache.get(webhookKey);
            data.processing = false;
        }

        if (eventKey && this.processingCache.has(eventKey)) {
            const data = this.processingCache.get(eventKey);
            data.processing = false;
        }
    }
}

// HTML cleanup utility
function cleanHTMLFromText(text) {
    if (!text) return "";

    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // Decode common HTML entities
    text = text.replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

    return text.trim();
}

// Enhanced duplicate detection
async function findDuplicateBookings(eventId, customerName, studio, startDate, startTime) {
    const duplicates = [];

    // 1. Find by calendar event ID (most reliable)
    if (eventId) {
        const eventDuplicates = await Booking.find({ calendarEventId: eventId });
        duplicates.push(...eventDuplicates);
    }

    // 2. Find by customer details and timing (for events without proper IDs)
    if (customerName && studio && startDate && startTime) {
        const cleanCustomerName = cleanHTMLFromText(customerName);

        // Look for similar bookings within 1 hour of the same date
        const dateStart = new Date(startDate);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(startDate);
        dateEnd.setHours(23, 59, 59, 999);

        const similarBookings = await Booking.find({
            studio: studio,
            startDate: { $gte: dateStart, $lte: dateEnd },
            $or: [
                { customerName: customerName },
                { customerName: cleanCustomerName },
                { customerName: { $regex: cleanCustomerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
            ]
        });

        duplicates.push(...similarBookings);
    }

    // Remove duplicates from the array itself
    const uniqueDuplicates = duplicates.filter((booking, index, self) =>
        index === self.findIndex(b => b._id.toString() === booking._id.toString())
    );

    return uniqueDuplicates;
}

// Clean up existing HTML-formatted customer names
async function cleanupHTMLNames() {
    console.log('🧹 CLEANING UP HTML-FORMATTED CUSTOMER NAMES...\n');

    try {
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find bookings with HTML in customer names
        const bookingsWithHTML = await Booking.find({
            customerName: { $regex: /<[^>]*>/, $options: 'i' }
        });

        console.log(`📋 Found ${bookingsWithHTML.length} bookings with HTML in customer names`);

        let cleaned = 0;
        for (const booking of bookingsWithHTML) {
            const originalName = booking.customerName;
            const cleanedName = cleanHTMLFromText(originalName);

            if (cleanedName !== originalName) {
                await Booking.findByIdAndUpdate(booking._id, {
                    customerName: cleanedName,
                    lastCleanupUpdate: new Date()
                });

                console.log(`✅ Cleaned: "${originalName}" → "${cleanedName}"`);
                cleaned++;
            }
        }

        console.log(`\n📊 CLEANUP SUMMARY: ${cleaned} customer names cleaned`);

    } catch (error) {
        console.error('❌ Error during HTML cleanup:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

// Remove duplicate bookings based on enhanced detection
async function removeDuplicateBookings() {
    console.log('🗑️ REMOVING DUPLICATE BOOKINGS...\n');

    try {
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find recent bookings (last 7 days) to check for duplicates
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentBookings = await Booking.find({
            createdAt: { $gte: sevenDaysAgo }
        }).sort({ createdAt: 1 }); // Oldest first

        console.log(`📋 Checking ${recentBookings.length} recent bookings for duplicates`);

        const processedEventIds = new Set();
        const processedBookings = new Set();
        let duplicatesRemoved = 0;

        for (const booking of recentBookings) {
            // Skip if already processed
            if (processedBookings.has(booking._id.toString())) {
                continue;
            }

            // Find all duplicates for this booking
            const duplicates = await findDuplicateBookings(
                booking.calendarEventId,
                booking.customerName,
                booking.studio,
                booking.startDate,
                booking.startTime
            );

            if (duplicates.length > 1) {
                console.log(`\n📦 Found ${duplicates.length} duplicates for: ${cleanHTMLFromText(booking.customerName)} - ${booking.studio}`);

                // Sort by creation date (keep the oldest)
                duplicates.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                const keepBooking = duplicates[0];
                const removeBookings = duplicates.slice(1);

                console.log(`   ✅ Keeping: ${keepBooking._id} (${keepBooking.createdAt.toLocaleString()})`);

                // Remove the duplicates
                for (const duplicate of removeBookings) {
                    await Booking.findByIdAndDelete(duplicate._id);
                    console.log(`   🗑️ Removed: ${duplicate._id} (${duplicate.createdAt.toLocaleString()})`);
                    duplicatesRemoved++;
                    processedBookings.add(duplicate._id.toString());
                }

                // Mark all as processed
                duplicates.forEach(dup => processedBookings.add(dup._id.toString()));
            } else {
                processedBookings.add(booking._id.toString());
            }
        }

        console.log(`\n📊 DUPLICATE REMOVAL SUMMARY: ${duplicatesRemoved} duplicate bookings removed`);

    } catch (error) {
        console.error('❌ Error during duplicate removal:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

// Main function to run all cleanup operations
async function runWebhookCleanup() {
    console.log('🚀 WEBHOOK DUPLICATE PREVENTION & CLEANUP');
    console.log('==========================================\n');

    // Step 1: Clean up HTML-formatted names
    await cleanupHTMLNames();

    console.log('\n' + '='.repeat(50) + '\n');

    // Step 2: Remove duplicate bookings
    await removeDuplicateBookings();

    console.log('\n✅ Webhook cleanup completed!');
}

// Export the utilities
module.exports = {
    WebhookDuplicatePrevention,
    cleanHTMLFromText,
    findDuplicateBookings,
    cleanupHTMLNames,
    removeDuplicateBookings,
    runWebhookCleanup
};

// Run cleanup if called directly
if (require.main === module) {
    runWebhookCleanup().catch(console.error);
} 