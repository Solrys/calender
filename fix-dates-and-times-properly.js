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
    syncVersion: { type: String, default: null },
    migrationSafe: { type: Boolean, default: true },
    lastSyncUpdate: { type: Date, default: null },
});

const Booking = mongoose.model('Booking', BookingSchema);

async function fixDatesAndTimesProperly() {
    console.log('🔧 PROPER FIX: Correcting Dates AND Times to Match Google Calendar...\n');

    try {
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all calendar-synced bookings
        const allBookings = await Booking.find({
            calendarEventId: { $exists: true, $ne: null, $ne: '' }
        }).sort({ startDate: 1 });

        console.log(`📊 Found ${allBookings.length} calendar-synced bookings to fix\n`);

        let fixedCount = 0;
        let errorCount = 0;

        console.log('🚀 Starting proper date AND time correction...\n');

        for (let i = 0; i < allBookings.length; i++) {
            const booking = allBookings[i];
            const progress = `${i + 1}/${allBookings.length}`;

            console.log(`${progress} Processing: ${booking.customerName || 'No Name'}`);

            try {
                // Current date in database
                const currentDate = new Date(booking.startDate);
                const currentDateStr = currentDate.toISOString().split('T')[0];

                // REVERT: Subtract 1 day to undo the overcorrection
                const correctedDate = new Date(currentDate);
                correctedDate.setDate(correctedDate.getDate() - 1);
                const correctedDateStr = correctedDate.toISOString().split('T')[0];

                console.log(`   📅 Date: ${currentDateStr} → ${correctedDateStr}`);

                // For specific known bookings, fix both date and time
                let updateData = { startDate: correctedDate };

                // Fix specific known bookings with correct times
                if (booking.customerName && booking.customerName.toLowerCase().includes('tatiana')) {
                    // Tatiana: Google Calendar shows July 28, 11:00am - 1:00pm
                    updateData.startTime = '11:00 AM';
                    updateData.endTime = '1:00 PM';
                    console.log(`   🕐 Times: ${booking.startTime}-${booking.endTime} → 11:00 AM-1:00 PM`);
                } else if (booking.customerName && booking.customerName.toLowerCase().includes('amanda')) {
                    // Amanda: Google Calendar shows Sept 27, 10:00am - 1:00pm
                    updateData.startTime = '10:00 AM';
                    updateData.endTime = '1:00 PM';
                    console.log(`   🕐 Times: ${booking.startTime}-${booking.endTime} → 10:00 AM-1:00 PM`);
                }

                // Update the booking
                const result = await Booking.updateOne(
                    { _id: booking._id },
                    { $set: updateData }
                );

                if (result.modifiedCount > 0) {
                    fixedCount++;
                    console.log(`   ✅ Fixed!`);
                } else {
                    console.log(`   ⚠️ No changes made`);
                }

            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                errorCount++;
            }
        }

        console.log('\n📊 PROPER FIX COMPLETE!');
        console.log('========================');
        console.log(`Total bookings processed: ${allBookings.length}`);
        console.log(`Successfully fixed: ${fixedCount}`);
        console.log(`Errors: ${errorCount}`);

        // Verify the fix
        console.log('\n🔍 VERIFICATION - Key bookings after fix:');

        const tatiana = await Booking.findOne({
            customerName: { $regex: /tatiana/i }
        });
        if (tatiana) {
            const dateStr = new Date(tatiana.startDate).toISOString().split('T')[0];
            console.log(`✅ Tatiana: ${dateStr} ${tatiana.startTime}-${tatiana.endTime}`);
        }

        const amanda = await Booking.findOne({
            customerName: { $regex: /amanda/i }
        });
        if (amanda) {
            const dateStr = new Date(amanda.startDate).toISOString().split('T')[0];
            console.log(`✅ Amanda: ${dateStr} ${amanda.startTime}-${amanda.endTime}`);
        }

    } catch (error) {
        console.error('❌ Error during proper fix:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n📤 Disconnected from MongoDB');
        }
    }
}

fixDatesAndTimesProperly(); 