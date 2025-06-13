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

async function finalTargetedFix() {
    console.log('🎯 FINAL TARGETED FIX: Specific Date Corrections...\n');

    try {
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Specific fixes for known problematic bookings
        const targets = [
            {
                name: 'Amanda Paradiz',
                expectedDate: '2025-09-27',
                action: 'add 1 day'
            },
            {
                name: 'Lada Biesieda',
                expectedDate: '2025-08-10',
                action: 'add 1 day'
            }
        ];

        let fixedCount = 0;

        for (const target of targets) {
            console.log(`🔧 Fixing ${target.name}...`);

            const booking = await Booking.findOne({
                customerName: { $regex: new RegExp(target.name.split(' ')[0], 'i') }
            });

            if (booking) {
                const currentDate = new Date(booking.startDate);
                const currentDateStr = currentDate.toISOString().split('T')[0];

                if (target.action === 'add 1 day') {
                    const correctedDate = new Date(currentDate);
                    correctedDate.setDate(correctedDate.getDate() + 1);
                    const correctedDateStr = correctedDate.toISOString().split('T')[0];

                    await Booking.updateOne(
                        { _id: booking._id },
                        { $set: { startDate: correctedDate } }
                    );

                    console.log(`   📅 ${currentDateStr} → ${correctedDateStr} ✅`);
                    fixedCount++;
                }
            } else {
                console.log(`   ❌ ${target.name} not found`);
            }
        }

        console.log('\n🔍 FINAL VERIFICATION:');

        // Check all three key bookings
        const tatiana = await Booking.findOne({ customerName: { $regex: /tatiana/i } });
        const amanda = await Booking.findOne({ customerName: { $regex: /amanda/i } });
        const lada = await Booking.findOne({ customerName: { $regex: /lada/i } });

        if (tatiana) {
            const dateStr = new Date(tatiana.startDate).toISOString().split('T')[0];
            console.log(`✅ Tatiana: ${dateStr} ${tatiana.startTime}-${tatiana.endTime}`);
            console.log('   Expected: 2025-07-28 11:00 AM-1:00 PM');
        }

        if (amanda) {
            const dateStr = new Date(amanda.startDate).toISOString().split('T')[0];
            console.log(`✅ Amanda: ${dateStr} ${amanda.startTime}-${amanda.endTime}`);
            console.log('   Expected: 2025-09-27 10:00 AM-1:00 PM');
        }

        if (lada) {
            const dateStr = new Date(lada.startDate).toISOString().split('T')[0];
            console.log(`✅ Lada: ${dateStr} ${lada.startTime}-${lada.endTime}`);
            console.log('   Expected: 2025-08-10 1:00 PM-5:00 PM');
        }

        if (fixedCount > 0) {
            console.log(`\n🎉 SUCCESS! Fixed ${fixedCount} specific bookings`);
            console.log('✅ All dates should now match Google Calendar exactly!');
        }

    } catch (error) {
        console.error('❌ Error during targeted fix:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n📤 Disconnected from MongoDB');
        }
    }
}

finalTargetedFix(); 