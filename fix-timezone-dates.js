// Fix Timezone Dates Script
// This script fixes existing bookings that have timezone-shifted dates

const mongoose = require('mongoose');
const { google } = require('googleapis');
const { formatInTimeZone } = require('date-fns-tz');
const fs = require('fs');

// Load environment variables manually
function loadEnv() {
    try {
        const envContent = fs.readFileSync('.env', 'utf8');
        const envVars = {};
        const lines = envContent.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#')) {
                const equalIndex = line.indexOf('=');
                if (equalIndex > 0) {
                    const key = line.substring(0, equalIndex).trim();
                    let value = line.substring(equalIndex + 1).trim();

                    // Handle multi-line values
                    while (i + 1 < lines.length && !lines[i + 1].includes('=') && !lines[i + 1].startsWith('#')) {
                        i++;
                        value += lines[i].trim();
                    }

                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    envVars[key] = value;
                }
            }
        }
        return envVars;
    } catch (error) {
        console.error('❌ Could not load .env file:', error.message);
        return {};
    }
}

const env = loadEnv();

// Booking Schema
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
    paymentStatus: { type: String, default: "manual" },
    customerName: { type: String, default: "" },
    customerEmail: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    event: { type: Boolean, default: false },
    calendarEventId: { type: String, unique: true, sparse: true },
    createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model('Booking', BookingSchema);

// Initialize Google Calendar API
async function initializeGoogleCalendar() {
    try {
        let serviceAccountKey = env.GOOGLE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountKey) {
            console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY not found in environment variables');
            return null;
        }

        const serviceAccount = JSON.parse(serviceAccountKey);

        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        const authClient = await auth.getClient();
        google.options({ auth: authClient });

        return google.calendar('v3');
    } catch (error) {
        console.error('❌ Failed to initialize Google Calendar API:', error);
        return null;
    }
}

// Get calendar event by ID
async function getCalendarEvent(calendar, calendarId, eventId) {
    try {
        const response = await calendar.events.get({
            calendarId: calendarId,
            eventId: eventId,
        });
        return response.data;
    } catch (error) {
        console.error(`❌ Error fetching event ${eventId}:`, error.message);
        return null;
    }
}

// Fix a single booking's date
function fixBookingDate(booking, calendarEvent) {
    const timeZone = "America/New_York";

    // Get the original calendar event's start time
    const startUtc = new Date(calendarEvent.start.dateTime || calendarEvent.start.date);

    // Build the correct local date string in ET
    const localDateString = formatInTimeZone(startUtc, timeZone, "yyyy-MM-dd");

    // Create a timezone-neutral date (same fix as in calendar-sync.js)
    const [year, month, day] = localDateString.split("-").map(Number);
    const correctedStartDate = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid daylight saving issues

    return correctedStartDate;
}

// Main fix function
async function fixTimezoneDates() {
    try {
        console.log('🔧 TIMEZONE DATE FIX TOOL');
        console.log('===========================');
        console.log('🎯 Fixing existing bookings with timezone-shifted dates');

        // Connect to MongoDB
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Initialize Google Calendar
        const calendar = await initializeGoogleCalendar();
        if (!calendar) {
            console.error('❌ Failed to initialize Google Calendar API');
            return;
        }

        console.log('✅ Connected to Google Calendar API');

        // Get calendar IDs from environment
        const calendarIds = [
            env.GOOGLE_CALENDAR_ID,
            env.GOOGLE_CALENDAR_ID_WEBSITE
        ].filter(id => id);

        // Find all bookings with calendar event IDs (these are the ones from calendar sync)
        const calendarBookings = await Booking.find({
            calendarEventId: { $exists: true, $ne: null, $ne: '' }
        }).sort({ startDate: 1 });

        console.log(`\n🔍 Found ${calendarBookings.length} calendar-synced bookings to check...`);

        let fixedCount = 0;
        let checkedCount = 0;
        let skippedCount = 0;

        for (const booking of calendarBookings) {
            checkedCount++;
            console.log(`\n${checkedCount}/${calendarBookings.length} Checking: ${booking.customerName || 'No name'} - ${booking.startDate.toISOString().split('T')[0]}`);

            let calendarEvent = null;

            // Try to find the event in both calendars
            for (const calendarId of calendarIds) {
                calendarEvent = await getCalendarEvent(calendar, calendarId, booking.calendarEventId);
                if (calendarEvent) {
                    console.log(`   📅 Found calendar event: "${calendarEvent.summary}"`);
                    break;
                }
            }

            if (!calendarEvent) {
                console.log(`   ⚠️  Calendar event not found for booking ${booking.calendarEventId}`);
                skippedCount++;
                continue;
            }

            // Calculate the correct date
            const correctedDate = fixBookingDate(booking, calendarEvent);

            // Check if the date needs fixing (compare date strings to avoid time precision issues)
            const currentDateStr = booking.startDate.toISOString().split('T')[0];
            const correctedDateStr = correctedDate.toISOString().split('T')[0];

            if (currentDateStr !== correctedDateStr) {
                console.log(`   🔧 Fixing date: ${currentDateStr} → ${correctedDateStr}`);

                // Update the booking
                await Booking.findByIdAndUpdate(booking._id, {
                    startDate: correctedDate
                });

                fixedCount++;
            } else {
                console.log(`   ✓ Date is already correct: ${correctedDateStr}`);
            }
        }

        console.log('\n📊 TIMEZONE FIX SUMMARY:');
        console.log('=========================');
        console.log(`Bookings checked: ${checkedCount}`);
        console.log(`Dates fixed: ${fixedCount}`);
        console.log(`Skipped (no calendar event): ${skippedCount}`);

        if (fixedCount > 0) {
            console.log('\n✅ Timezone date fix completed successfully!');
            console.log(`${fixedCount} booking date(s) corrected for proper timezone display.`);
            console.log('\n💡 Your LA client should now see the correct dates in their dashboard!');
        } else {
            console.log('\n✅ All booking dates were already correct.');
        }

    } catch (error) {
        console.error('❌ Timezone date fix failed:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n📤 Disconnected from MongoDB');
        }
    }
}

// Dry run mode
async function dryRunFix() {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('=========================================');
    console.log('📅 Would fix timezone-shifted dates in existing bookings');

    try {
        // Connect to MongoDB
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB (read-only)');

        // Initialize Google Calendar
        const calendar = await initializeGoogleCalendar();
        if (!calendar) {
            console.error('❌ Failed to initialize Google Calendar API');
            return;
        }

        console.log('✅ Connected to Google Calendar API');

        // Get calendar IDs
        const calendarIds = [
            env.GOOGLE_CALENDAR_ID,
            env.GOOGLE_CALENDAR_ID_WEBSITE
        ].filter(id => id);

        // Find bookings to check
        const calendarBookings = await Booking.find({
            calendarEventId: { $exists: true, $ne: null, $ne: '' }
        }).sort({ startDate: 1 });

        console.log(`\n🔍 Would check ${calendarBookings.length} calendar-synced bookings...`);

        let wouldFix = 0;

        // Check first 10 bookings as sample
        const sampleBookings = calendarBookings.slice(0, 10);

        for (const booking of sampleBookings) {
            let calendarEvent = null;

            // Try to find the event in both calendars
            for (const calendarId of calendarIds) {
                calendarEvent = await getCalendarEvent(calendar, calendarId, booking.calendarEventId);
                if (calendarEvent) break;
            }

            if (calendarEvent) {
                const correctedDate = fixBookingDate(booking, calendarEvent);
                const currentDateStr = booking.startDate.toISOString().split('T')[0];
                const correctedDateStr = correctedDate.toISOString().split('T')[0];

                if (currentDateStr !== correctedDateStr) {
                    console.log(`   📝 Would fix: "${booking.customerName || 'No name'}" - ${currentDateStr} → ${correctedDateStr}`);
                    wouldFix++;
                }
            }
        }

        // Estimate total fixes needed
        const estimatedTotalFixes = Math.round((wouldFix / sampleBookings.length) * calendarBookings.length);

        console.log(`\n📊 DRY RUN SUMMARY (based on ${sampleBookings.length} sample bookings):`);
        console.log(`Would fix approximately: ${estimatedTotalFixes} booking dates`);
        console.log(`\nTo execute the fix, run: node fix-timezone-dates.js --execute`);

    } catch (error) {
        console.error('❌ Dry run failed:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--execute') || args.includes('-e')) {
        await fixTimezoneDates();
    } else {
        await dryRunFix();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
} 