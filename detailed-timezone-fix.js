// Detailed Timezone Fix Script
// This script shows detailed comparison between Google Calendar and Database dates

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

                    while (i + 1 < lines.length && !lines[i + 1].includes('=') && !lines[i + 1].startsWith('#')) {
                        i++;
                        value += lines[i].trim();
                    }

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

// Get calendar event by ID with detailed info
async function getCalendarEventDetails(calendar, calendarId, eventId) {
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

// Detailed comparison function
function analyzeBookingVsCalendar(booking, calendarEvent) {
    console.log(`\n🔍 DETAILED ANALYSIS FOR: ${booking.customerName || 'No Name'}`);
    console.log(`   Event ID: ${booking.calendarEventId}`);
    console.log(`   Database Booking ID: ${booking._id}`);

    // Raw Google Calendar data
    console.log(`\n📅 GOOGLE CALENDAR RAW DATA:`);
    console.log(`   Summary: ${calendarEvent.summary}`);
    console.log(`   Start DateTime: ${calendarEvent.start.dateTime}`);
    console.log(`   Start TimeZone: ${calendarEvent.start.timeZone}`);
    console.log(`   End DateTime: ${calendarEvent.end.dateTime}`);
    console.log(`   End TimeZone: ${calendarEvent.end.timeZone}`);

    // Parse Google Calendar dates
    const gcStartUtc = new Date(calendarEvent.start.dateTime);
    const gcEndUtc = new Date(calendarEvent.end.dateTime);
    const gcTimezone = calendarEvent.start.timeZone || "America/New_York";

    console.log(`\n🌍 GOOGLE CALENDAR PARSED:`);
    console.log(`   UTC Start: ${gcStartUtc.toISOString()}`);
    console.log(`   UTC End: ${gcEndUtc.toISOString()}`);
    console.log(`   Calendar Timezone: ${gcTimezone}`);

    // Format in different timezones for comparison
    const gcDateEastern = formatInTimeZone(gcStartUtc, "America/New_York", "yyyy-MM-dd");
    const gcTimeEastern = formatInTimeZone(gcStartUtc, "America/New_York", "h:mm a");
    const gcDatePacific = formatInTimeZone(gcStartUtc, "America/Los_Angeles", "yyyy-MM-dd");
    const gcTimePacific = formatInTimeZone(gcStartUtc, "America/Los_Angeles", "h:mm a");

    console.log(`\n⏰ GOOGLE CALENDAR TIMES:`);
    console.log(`   Eastern Time: ${gcDateEastern} ${gcTimeEastern}`);
    console.log(`   Pacific Time: ${gcDatePacific} ${gcTimePacific}`);

    // Database booking data
    console.log(`\n🗄️ DATABASE BOOKING DATA:`);
    console.log(`   Stored Date: ${booking.startDate.toISOString()}`);
    console.log(`   Date String: ${booking.startDate.toISOString().split('T')[0]}`);
    console.log(`   Start Time: ${booking.startTime}`);
    console.log(`   End Time: ${booking.endTime}`);
    console.log(`   Studio: ${booking.studio}`);
    console.log(`   Payment Status: ${booking.paymentStatus}`);

    // Calculate what the correct date should be
    const correctDateEastern = formatInTimeZone(gcStartUtc, "America/New_York", "yyyy-MM-dd");
    const [year, month, day] = correctDateEastern.split("-").map(Number);
    const correctedDate = new Date(year, month - 1, day);

    console.log(`\n🔧 CORRECTION ANALYSIS:`);
    console.log(`   Current DB Date: ${booking.startDate.toISOString().split('T')[0]}`);
    console.log(`   Correct Date (Eastern): ${correctDateEastern}`);
    console.log(`   Corrected Date Object: ${correctedDate.toISOString()}`);

    // Determine if fix is needed
    const currentDateStr = booking.startDate.toISOString().split('T')[0];
    const needsFix = currentDateStr !== correctDateEastern;

    console.log(`\n💡 CONCLUSION:`);
    if (needsFix) {
        console.log(`   ❌ NEEDS FIX: ${currentDateStr} → ${correctDateEastern}`);
        console.log(`   📅 Date shift: ${calculateDateDifference(booking.startDate, correctedDate)} day(s)`);
    } else {
        console.log(`   ✅ CORRECT: Date matches (${correctDateEastern})`);
    }

    return {
        needsFix,
        currentDate: booking.startDate,
        correctDate: correctedDate,
        currentDateStr,
        correctDateStr: correctDateEastern,
        calendarTimezone: gcTimezone
    };
}

// Calculate date difference in days
function calculateDateDifference(date1, date2) {
    const diffTime = Math.abs(date2 - date1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Main detailed analysis function
async function detailedTimezoneAnalysis() {
    try {
        console.log('🔍 DETAILED TIMEZONE ANALYSIS TOOL');
        console.log('===================================');
        console.log('🎯 Analyzing each booking vs Google Calendar in detail');

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

        // Get calendar IDs
        const calendarIds = [
            env.GOOGLE_CALENDAR_ID,
            env.GOOGLE_CALENDAR_ID_WEBSITE
        ].filter(id => id);

        console.log(`\n📋 Will check calendars:`);
        calendarIds.forEach((id, index) => {
            const name = index === 0 ? 'Manual Booking Calendar' : 'Website Booking Calendar';
            console.log(`   ${index + 1}. ${name}: ${id}`);
        });

        // Find all bookings with calendar event IDs
        const calendarBookings = await Booking.find({
            calendarEventId: { $exists: true, $ne: null, $ne: '' }
        }).sort({ startDate: 1 });

        console.log(`\n🔍 Found ${calendarBookings.length} calendar-synced bookings to analyze...`);

        let analyzedCount = 0;
        let needsFixCount = 0;
        let correctCount = 0;
        let errorCount = 0;
        const fixableBookings = [];

        for (const booking of calendarBookings) {
            analyzedCount++;
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📊 ANALYSIS ${analyzedCount}/${calendarBookings.length}`);

            let calendarEvent = null;
            let foundInCalendar = null;

            // Try to find the event in both calendars
            for (const calendarId of calendarIds) {
                calendarEvent = await getCalendarEventDetails(calendar, calendarId, booking.calendarEventId);
                if (calendarEvent) {
                    foundInCalendar = calendarId;
                    console.log(`   📅 Found in: ${calendarId === env.GOOGLE_CALENDAR_ID ? 'Manual Calendar' : 'Website Calendar'}`);
                    break;
                }
            }

            if (!calendarEvent) {
                console.log(`   ❌ Calendar event not found for booking ${booking.calendarEventId}`);
                errorCount++;
                continue;
            }

            // Detailed analysis
            const analysis = analyzeBookingVsCalendar(booking, calendarEvent);

            if (analysis.needsFix) {
                needsFixCount++;
                fixableBookings.push({
                    booking,
                    calendarEvent,
                    analysis,
                    foundInCalendar
                });
            } else {
                correctCount++;
            }

            // Add a pause for readability (remove this if running programmatically)
            if (analyzedCount <= 5) {
                console.log(`\n⏸️  [Showing first 5 in detail - set limit in code]`);
            } else {
                console.log(`   📝 Quick check: ${analysis.needsFix ? 'NEEDS FIX' : 'CORRECT'}`);
            }
        }

        // Summary
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 DETAILED ANALYSIS SUMMARY:`);
        console.log(`${'='.repeat(80)}`);
        console.log(`Total bookings analyzed: ${analyzedCount}`);
        console.log(`✅ Already correct: ${correctCount}`);
        console.log(`❌ Need fixing: ${needsFixCount}`);
        console.log(`⚠️ Errors (event not found): ${errorCount}`);

        if (needsFixCount > 0) {
            console.log(`\n🔧 BOOKINGS THAT NEED FIXING:`);
            fixableBookings.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.booking.customerName || 'No Name'} - ${item.analysis.currentDateStr} → ${item.analysis.correctDateStr}`);
            });

            console.log(`\n💡 To fix these bookings, run:`);
            console.log(`   node detailed-timezone-fix.js --execute`);
        } else {
            console.log(`\n✅ All bookings have correct dates!`);
        }

    } catch (error) {
        console.error('❌ Detailed analysis failed:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n📤 Disconnected from MongoDB');
        }
    }
}

// Execute fixes based on detailed analysis
async function executeDetailedFixes() {
    try {
        console.log('🔧 EXECUTING DETAILED TIMEZONE FIXES');
        console.log('=====================================');

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

        // Get calendar IDs
        const calendarIds = [
            env.GOOGLE_CALENDAR_ID,
            env.GOOGLE_CALENDAR_ID_WEBSITE
        ].filter(id => id);

        // Find bookings to fix
        const calendarBookings = await Booking.find({
            calendarEventId: { $exists: true, $ne: null, $ne: '' }
        }).sort({ startDate: 1 });

        console.log(`\n🔍 Checking ${calendarBookings.length} bookings for fixes...`);

        let fixedCount = 0;

        for (const booking of calendarBookings) {
            let calendarEvent = null;

            // Find the calendar event
            for (const calendarId of calendarIds) {
                calendarEvent = await getCalendarEventDetails(calendar, calendarId, booking.calendarEventId);
                if (calendarEvent) break;
            }

            if (!calendarEvent) continue;

            // Calculate correct date
            const gcStartUtc = new Date(calendarEvent.start.dateTime);
            const correctDateEastern = formatInTimeZone(gcStartUtc, "America/New_York", "yyyy-MM-dd");
            const [year, month, day] = correctDateEastern.split("-").map(Number);
            const correctedDate = new Date(year, month - 1, day);

            // Check if fix is needed
            const currentDateStr = booking.startDate.toISOString().split('T')[0];
            if (currentDateStr !== correctDateEastern) {
                console.log(`\n🔧 FIXING: ${booking.customerName || 'No Name'}`);
                console.log(`   ${currentDateStr} → ${correctDateEastern}`);

                // Update the booking
                await Booking.findByIdAndUpdate(booking._id, {
                    startDate: correctedDate
                });

                fixedCount++;
            }
        }

        console.log(`\n✅ FIXES COMPLETED: ${fixedCount} bookings updated`);

    } catch (error) {
        console.error('❌ Execute fixes failed:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n📤 Disconnected from MongoDB');
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--execute') || args.includes('-e')) {
        await executeDetailedFixes();
    } else {
        await detailedTimezoneAnalysis();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
} 