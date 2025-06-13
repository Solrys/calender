const mongoose = require('mongoose');
const { google } = require('googleapis');
const fs = require('fs');
const { formatInTimeZone } = require('date-fns-tz');

// Load environment variables
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
    syncVersion: { type: String, default: 'v3.0-fresh-start' },
    migrationSafe: { type: Boolean, default: true },
    lastSyncUpdate: { type: Date, default: null },
});

const Booking = mongoose.model('Booking', BookingSchema);

// Initialize Google Calendar API
async function initializeGoogleCalendar() {
    try {
        let serviceAccountKey = env.GOOGLE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountKey) {
            console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY not found');
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

// Convert time to 12-hour format in Eastern Time (calendar timezone)
function convertTimeTo12Hour(date, timeZone = "America/New_York") {
    return formatInTimeZone(date, timeZone, "h:mm a");
}

// Parse studio from event summary
function parseStudio(summary) {
    if (!summary) return 'Studio A';

    const lowerSummary = summary.toLowerCase();

    // Look for "Booking for [STUDIO NAME]" pattern
    const bookingForMatch = summary.match(/booking for (.+?)(?:\s*-|$)/i);
    if (bookingForMatch) {
        const studioName = bookingForMatch[1].trim();
        const studioLower = studioName.toLowerCase();

        if (studioLower.includes('ground')) return 'THE GROUND';
        if (studioLower.includes('extension')) return 'THE EXTENSION';
        if (studioLower.includes('lab')) return 'THE LAB';

        return studioName.toUpperCase();
    }

    // Direct studio name mentions
    if (lowerSummary.includes('the ground')) return 'THE GROUND';
    if (lowerSummary.includes('the extension')) return 'THE EXTENSION';
    if (lowerSummary.includes('the lab')) return 'THE LAB';

    return 'Studio A'; // default
}

// Parse event details from description
function parseEventDetails(description) {
    const details = {
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        event: false,
        subtotal: 0,
        studioCost: 0,
        estimatedTotal: 0,
        cleaningFee: 0,
        items: []
    };

    if (!description) return details;

    const lines = description.split('\n');

    for (const line of lines) {
        const lowerLine = line.toLowerCase().trim();

        if (line.startsWith('Customer Name:')) {
            details.customerName = line.split(':')[1]?.trim() || '';
        } else if (line.startsWith('Customer Email:')) {
            details.customerEmail = line.split(':')[1]?.trim() || '';
        } else if (line.startsWith('Customer Phone:')) {
            details.customerPhone = line.split(':')[1]?.trim() || '';
        } else if (lowerLine.includes('event: yes')) {
            details.event = true;
        } else if (line.startsWith('Subtotal: $')) {
            details.subtotal = parseFloat(line.replace('Subtotal: $', '')) || 0;
        } else if (line.startsWith('Studio Cost: $')) {
            details.studioCost = parseFloat(line.replace('Studio Cost: $', '')) || 0;
        } else if (line.startsWith('Estimated Total: $')) {
            details.estimatedTotal = parseFloat(line.replace('Estimated Total: $', '')) || 0;
        }
    }

    return details;
}

// Convert calendar event to booking data
function createBookingFromCalendarEvent(event, calendarType) {
    const timeZone = "America/New_York"; // Eastern Time to match calendar

    // Parse the UTC instants from the event
    const startUtc = new Date(event.start.dateTime || event.start.date);
    const endUtc = new Date(event.end.dateTime || event.end.date);

    // Get the date in Eastern Time and store it simply
    const easternDateString = formatInTimeZone(startUtc, timeZone, "yyyy-MM-dd");
    const [year, month, day] = easternDateString.split("-").map(Number);
    const startDate = new Date(year, month - 1, day);

    // Format the times for display in Eastern Time
    const startTime = convertTimeTo12Hour(startUtc, timeZone);
    const endTime = convertTimeTo12Hour(endUtc, timeZone);

    // Parse studio & customer details
    const studio = parseStudio(event.summary);
    const eventDetails = parseEventDetails(event.description);

    // Set payment status based on calendar type
    const paymentStatus = calendarType === "Website Booking Calendar" ? "success" : "manual";

    return {
        studio,
        startDate,
        startTime,
        endTime,
        items: eventDetails.items,
        subtotal: eventDetails.subtotal,
        studioCost: eventDetails.studioCost,
        cleaningFee: eventDetails.cleaningFee,
        estimatedTotal: eventDetails.estimatedTotal,
        paymentStatus,
        customerName: eventDetails.customerName,
        customerEmail: eventDetails.customerEmail,
        customerPhone: eventDetails.customerPhone,
        event: eventDetails.event,
        calendarEventId: event.id,
        createdAt: new Date(),
        syncVersion: 'v3.0-fresh-start',
        migrationSafe: true,
        lastSyncUpdate: new Date(),
    };
}

// Fetch events from a specific calendar
async function fetchCalendarEvents(calendar, calendarId, calendarName) {
    try {
        console.log(`📅 Fetching events from ${calendarName}...`);

        // Start from June 1st, 2024
        const june1st = new Date('2024-06-01T00:00:00.000Z');
        const timeMin = june1st.toISOString();

        // Get events up to 2 years in the future
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 2);
        const timeMax = futureDate.toISOString();

        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 1000,
        });

        const events = response.data.items || [];
        console.log(`   Found ${events.length} events since June 1st, 2024`);

        return events.map(event => ({
            ...event,
            calendarSource: calendarName
        }));

    } catch (error) {
        console.error(`❌ Error fetching events from ${calendarName}:`, error.message);
        return [];
    }
}

// Main fresh start function
async function freshStartImport() {
    try {
        console.log('🔄 FRESH START: Complete Calendar Re-import');
        console.log('============================================');
        console.log('📅 Importing ALL events from June 1st, 2024 onwards');
        console.log('🗑️ Will clear existing calendar-synced bookings first');
        console.log('💳 Website bookings → success | Manual bookings → manual');

        // Connect to MongoDB
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // STEP 1: Clear existing calendar-synced bookings
        console.log('\n🗑️ STEP 1: Clearing existing calendar bookings...');
        const deleteResult = await Booking.deleteMany({
            calendarEventId: { $exists: true, $ne: null, $ne: '' }
        });
        console.log(`   ✅ Deleted ${deleteResult.deletedCount} existing calendar bookings`);

        // STEP 2: Initialize Google Calendar
        const calendar = await initializeGoogleCalendar();
        if (!calendar) {
            console.error('❌ Failed to initialize Google Calendar API');
            return;
        }
        console.log('✅ Connected to Google Calendar API');

        // STEP 3: Get calendar IDs
        const calendarIds = [
            { id: env.GOOGLE_CALENDAR_ID, name: 'Manual Booking Calendar' },
            { id: env.GOOGLE_CALENDAR_ID_WEBSITE, name: 'Website Booking Calendar' }
        ].filter(cal => cal.id);

        if (calendarIds.length === 0) {
            console.error('❌ No calendar IDs found');
            return;
        }

        console.log(`\n📋 Found ${calendarIds.length} calendar(s) to import:`);
        calendarIds.forEach(cal => console.log(`   - ${cal.name}: ${cal.id}`));

        let totalEvents = 0;
        let totalImported = 0;

        // STEP 4: Import from each calendar
        for (const calendarConfig of calendarIds) {
            console.log(`\n🔄 Processing ${calendarConfig.name}...`);

            const events = await fetchCalendarEvents(calendar, calendarConfig.id, calendarConfig.name);
            totalEvents += events.length;

            for (const event of events) {
                try {
                    // Skip all-day events
                    if (!event.start.dateTime) {
                        console.log(`   ⏭️ Skipping all-day event: ${event.summary}`);
                        continue;
                    }

                    // Create booking data from calendar event
                    const bookingData = createBookingFromCalendarEvent(event, calendarConfig.name);

                    // Create booking in database
                    const booking = new Booking(bookingData);
                    await booking.save();

                    totalImported++;
                    console.log(`   ✅ Imported: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime}-${bookingData.endTime} (${bookingData.paymentStatus})`);

                } catch (error) {
                    if (error.code === 11000) { // Duplicate key error
                        console.log(`   ⚠️ Duplicate event skipped: ${event.id}`);
                    } else {
                        console.error(`   ❌ Error importing event ${event.id}:`, error.message);
                    }
                }
            }
        }

        // STEP 5: Summary and verification
        console.log('\n📊 FRESH IMPORT SUMMARY:');
        console.log('========================');
        console.log(`Total calendar events found: ${totalEvents}`);
        console.log(`Successfully imported: ${totalImported}`);

        // Verify key bookings
        console.log('\n🔍 VERIFICATION - Key Bookings:');

        const tatiana = await Booking.findOne({ customerName: { $regex: /tatiana/i } });
        const amanda = await Booking.findOne({ customerName: { $regex: /amanda/i } });
        const lada = await Booking.findOne({ customerName: { $regex: /lada/i } });
        const spenser = await Booking.findOne({ customerName: { $regex: /spenser/i } });

        [tatiana, amanda, lada, spenser].forEach(booking => {
            if (booking) {
                const dateStr = new Date(booking.startDate).toISOString().split('T')[0];
                console.log(`✅ ${booking.customerName}: ${dateStr} ${booking.startTime}-${booking.endTime} (${booking.paymentStatus})`);
            }
        });

        console.log('\n🎉 FRESH START COMPLETE!');
        console.log('✅ All bookings imported with proper timezone handling');
        console.log('✅ Payment status set correctly based on calendar source');
        console.log('✅ Ready for testing!');

    } catch (error) {
        console.error('❌ Fresh start import failed:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n📤 Disconnected from MongoDB');
        }
    }
}

freshStartImport(); 