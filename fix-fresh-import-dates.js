const mongoose = require('mongoose');
const fs = require('fs');

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

async function fixFreshImportDates() {
    try {
        console.log('🔧 FIXING FRESH IMPORT DATES');
        console.log('============================');
        console.log('Adding +1 day to all calendar-synced bookings to match Google Calendar\n');

        // Connect to MongoDB
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all calendar-synced bookings (those with calendarEventId)
        const calendarBookings = await Booking.find({
            calendarEventId: { $exists: true, $ne: null, $ne: '' }
        });

        console.log(`📋 Found ${calendarBookings.length} calendar-synced bookings to fix\n`);

        let fixedCount = 0;

        for (const booking of calendarBookings) {
            try {
                // Add 1 day to the start date
                const currentDate = new Date(booking.startDate);
                const newDate = new Date(currentDate);
                newDate.setDate(newDate.getDate() + 1);

                // Update the booking
                await Booking.updateOne(
                    { _id: booking._id },
                    {
                        startDate: newDate,
                        syncVersion: 'v3.1-date-corrected',
                        lastSyncUpdate: new Date()
                    }
                );

                const oldDateStr = currentDate.toISOString().split('T')[0];
                const newDateStr = newDate.toISOString().split('T')[0];

                console.log(`✅ ${booking.customerName || 'No name'}: ${oldDateStr} → ${newDateStr} (${booking.startTime}-${booking.endTime})`);
                fixedCount++;

            } catch (error) {
                console.error(`❌ Error fixing booking ${booking._id}:`, error.message);
            }
        }

        console.log(`\n📊 SUMMARY:`);
        console.log(`Total bookings processed: ${calendarBookings.length}`);
        console.log(`Successfully fixed: ${fixedCount}`);

        // Verify key bookings
        console.log('\n🔍 VERIFICATION - Key Bookings After Fix:');

        const tatiana = await Booking.findOne({ customerName: { $regex: /tatiana/i } });
        const amanda = await Booking.findOne({ customerName: { $regex: /amanda/i } });
        const lada = await Booking.findOne({ customerName: { $regex: /lada/i } });

        [tatiana, amanda, lada].forEach(booking => {
            if (booking) {
                const dateStr = new Date(booking.startDate).toISOString().split('T')[0];
                console.log(`✅ ${booking.customerName}: ${dateStr} ${booking.startTime}-${booking.endTime}`);
            }
        });

        console.log('\n🎉 DATE CORRECTION COMPLETE!');
        console.log('✅ All calendar bookings should now match Google Calendar dates exactly');

    } catch (error) {
        console.error('❌ Date correction failed:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n📤 Disconnected from MongoDB');
        }
    }
}

fixFreshImportDates(); 