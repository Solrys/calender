// Migration Preview Script
// This script shows you exactly what will be affected by the migration
// WITHOUT making any changes to your database

const mongoose = require('mongoose');
const fs = require('fs');

// MIGRATION SETTINGS - Must match calendar-sync.js
const MIGRATION_TIMESTAMP = new Date('2024-06-13T00:00:00Z');
const SYNC_VERSION = 'v2.0-pacific-timezone';
const SAFE_MODE = true;

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

async function previewMigration() {
    try {
        console.log('🔍 MIGRATION PREVIEW - NO CHANGES WILL BE MADE');
        console.log('===============================================');
        console.log(`🛡️ SAFE MODE: ${SAFE_MODE ? 'ENABLED' : 'DISABLED'}`);
        console.log(`📅 Migration Timestamp: ${MIGRATION_TIMESTAMP.toISOString()}`);
        console.log(`🏷️ Sync Version: ${SYNC_VERSION}`);
        console.log('');

        // Connect to MongoDB
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB (read-only)');

        // Get all current bookings
        const allBookings = await Booking.find({}).sort({ startDate: 1 });
        console.log(`📊 Total bookings in database: ${allBookings.length}`);

        if (allBookings.length === 0) {
            console.log('⚠️ No bookings found in database');
            return;
        }

        // Analyze bookings by categories
        const categories = {
            protected: [],
            willBeUpdated: [],
            alreadyMigrated: [],
            websiteBookings: [],
            manualBookings: [],
            orphaned: []
        };

        for (const booking of allBookings) {
            const bookingDate = new Date(booking.startDate);

            // Check if already migrated
            if (booking.syncVersion === SYNC_VERSION) {
                categories.alreadyMigrated.push(booking);
                continue;
            }

            // Check if has calendar event
            if (!booking.calendarEventId) {
                categories.orphaned.push(booking);
                continue;
            }

            // Categorize by payment status
            if (booking.paymentStatus === 'success') {
                categories.websiteBookings.push(booking);
            } else if (booking.paymentStatus === 'manual') {
                categories.manualBookings.push(booking);
            }

            // Check if will be protected
            if (SAFE_MODE && bookingDate < MIGRATION_TIMESTAMP) {
                categories.protected.push(booking);
            } else {
                categories.willBeUpdated.push(booking);
            }
        }

        // Display analysis
        console.log('\n📊 MIGRATION IMPACT ANALYSIS:');
        console.log('==============================');

        console.log(`\n🛡️ PROTECTED BOOKINGS (will NOT be changed): ${categories.protected.length}`);
        if (categories.protected.length > 0) {
            console.log('   These bookings are before the migration timestamp and will remain untouched:');
            categories.protected.slice(0, 5).forEach(booking => {
                console.log(`   - ${booking.customerName || 'No name'} | ${booking.studio} | ${booking.startDate.toDateString()} | ${booking.paymentStatus}`);
            });
            if (categories.protected.length > 5) {
                console.log(`   ... and ${categories.protected.length - 5} more`);
            }
        }

        console.log(`\n📝 WILL BE UPDATED (migration tracking added): ${categories.willBeUpdated.length}`);
        if (categories.willBeUpdated.length > 0) {
            console.log('   These bookings will get migration tracking fields:');
            categories.willBeUpdated.slice(0, 5).forEach(booking => {
                console.log(`   - ${booking.customerName || 'No name'} | ${booking.studio} | ${booking.startDate.toDateString()} | ${booking.paymentStatus}`);
            });
            if (categories.willBeUpdated.length > 5) {
                console.log(`   ... and ${categories.willBeUpdated.length - 5} more`);
            }
        }

        console.log(`\n✅ ALREADY MIGRATED: ${categories.alreadyMigrated.length}`);
        if (categories.alreadyMigrated.length > 0) {
            console.log('   These bookings already have the new migration tracking.');
        }

        console.log(`\n💻 WEBSITE BOOKINGS: ${categories.websiteBookings.length}`);
        console.log(`🖐️ MANUAL BOOKINGS: ${categories.manualBookings.length}`);
        console.log(`🔗 ORPHANED BOOKINGS (no calendar event): ${categories.orphaned.length}`);

        // Show timeline
        console.log('\n📅 TIMELINE ANALYSIS:');
        console.log('=====================');

        const beforeMigration = allBookings.filter(b => new Date(b.startDate) < MIGRATION_TIMESTAMP);
        const afterMigration = allBookings.filter(b => new Date(b.startDate) >= MIGRATION_TIMESTAMP);

        console.log(`📅 Bookings before ${MIGRATION_TIMESTAMP.toDateString()}: ${beforeMigration.length} (PROTECTED)`);
        console.log(`📅 Bookings after ${MIGRATION_TIMESTAMP.toDateString()}: ${afterMigration.length} (WILL USE NEW LOGIC)`);

        // Safety recommendations
        console.log('\n🛡️ SAFETY RECOMMENDATIONS:');
        console.log('===========================');

        if (categories.protected.length > 0) {
            console.log('✅ SAFE: Your existing bookings are protected by the migration timestamp');
        }

        if (categories.orphaned.length > 0) {
            console.log(`⚠️ ATTENTION: ${categories.orphaned.length} bookings have no calendar events`);
            console.log('   These might be old website bookings or test data');
        }

        console.log('\n🚀 NEXT STEPS:');
        console.log('==============');
        console.log('1. Review the analysis above');
        console.log('2. If you\'re satisfied, run: node calendar-sync.js --execute');
        console.log('3. The webhook will automatically use the same safe migration logic');
        console.log('4. You can always adjust MIGRATION_TIMESTAMP if needed');
        console.log('5. Set SAFE_MODE=false only when you\'re confident everything works');

    } catch (error) {
        console.error('❌ Migration preview failed:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n📤 Disconnected from MongoDB');
        }
    }
}

// Run the preview
if (require.main === module) {
    previewMigration().catch(console.error);
}

module.exports = { previewMigration }; 