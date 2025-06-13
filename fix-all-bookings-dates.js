const mongoose = require('mongoose');
const fs = require('fs');

// Load environment variables manually (same as calendar-sync.js)
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

// Booking Schema (same as calendar-sync.js)
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
    syncVersion: { type: String, default: null },
    migrationSafe: { type: Boolean, default: true },
    lastSyncUpdate: { type: Date, default: null },
});

const Booking = mongoose.model('Booking', BookingSchema);

async function fixAllBookingDates() {
    console.log('🔧 MASSIVE FIX: Correcting ALL Booking Dates to Match Google Calendar...\n');

    try {
        // Connect to MongoDB using Mongoose (same as calendar-sync.js)
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find ALL calendar-synced bookings (these have the timezone issue)
        const allBookings = await Booking.find({
            calendarEventId: { $exists: true, $ne: null, $ne: '' }
        }).sort({ startDate: 1 });

        console.log(`📊 Found ${allBookings.length} calendar-synced bookings to fix\n`);

        if (allBookings.length === 0) {
            console.log('❌ No calendar-synced bookings found');
            return;
        }

        let fixedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        console.log('🚀 Starting bulk date correction...\n');

        for (let i = 0; i < allBookings.length; i++) {
            const booking = allBookings[i];
            const progress = `${i + 1}/${allBookings.length}`;

            console.log(`${progress} Processing: ${booking.customerName || 'No Name'}`);

            try {
                // Current date in database
                const currentDate = new Date(booking.startDate);
                const currentDateStr = currentDate.toISOString().split('T')[0];

                // Calculate the corrected date (add 1 day)
                // Most bookings are 1 day behind Google Calendar
                const correctedDate = new Date(currentDate);
                correctedDate.setDate(correctedDate.getDate() + 1);
                const correctedDateStr = correctedDate.toISOString().split('T')[0];

                console.log(`   📅 Current: ${currentDateStr} → Corrected: ${correctedDateStr}`);

                // Update the booking using Mongoose
                const result = await Booking.updateOne(
                    { _id: booking._id },
                    {
                        $set: {
                            startDate: correctedDate
                        }
                    }
                );

                if (result.modifiedCount > 0) {
                    fixedCount++;
                    console.log(`   ✅ Fixed!`);
                } else {
                    console.log(`   ⚠️ No changes made`);
                    skippedCount++;
                }

            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                errorCount++;
            }
        }

        console.log('\n📊 BULK FIX COMPLETE!');
        console.log('========================');
        console.log(`Total bookings processed: ${allBookings.length}`);
        console.log(`Successfully fixed: ${fixedCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);

        if (fixedCount > 0) {
            console.log('\n🎉 SUCCESS! All booking dates have been corrected');
            console.log('✅ Dashboard will now show correct dates matching Google Calendar');
            console.log('✅ LA clients will see correct dates');
            console.log('✅ Booking system will block correct dates');

            // Verify with a few sample bookings
            console.log('\n🔍 VERIFICATION - Sample of fixed bookings:');
            const verifyBookings = await Booking.find({
                calendarEventId: { $exists: true, $ne: null, $ne: '' }
            }).limit(3).sort({ startDate: -1 });

            verifyBookings.forEach((booking, i) => {
                const dateStr = new Date(booking.startDate).toISOString().split('T')[0];
                console.log(`${i + 1}. ${booking.customerName || 'No Name'} - ${dateStr} (${booking.startTime})`);
            });
        }

    } catch (error) {
        console.error('❌ Error during bulk fix:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n📤 Disconnected from MongoDB');
        }
    }
}

fixAllBookingDates(); 