const mongoose = require('mongoose');
const fs = require('fs');

// Load environment variables
function loadEnv() {
    const env = {};
    const possiblePaths = ['.env', '.env.local'];
    for (const envPath of possiblePaths) {
        if (fs.existsSync(envPath)) {
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
    return { ...process.env, ...env };
}

const env = loadEnv();

// Booking Schema
const BookingSchema = new mongoose.Schema({
    studio: String,
    startDate: Date,
    startTime: String,
    endTime: String,
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    paymentStatus: String,
    calendarEventId: String,
    createdAt: { type: Date, default: Date.now },
    syncVersion: String,
}, { strict: false });

const Booking = mongoose.model('Booking', BookingSchema);

async function quickCleanup() {
    try {
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find recent test bookings (last 24 hours)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const testBookings = await Booking.find({
            createdAt: { $gte: yesterday },
            customerName: /test/i
        }).sort({ createdAt: 1 });

        console.log(`📋 Found ${testBookings.length} test bookings from last 24 hours`);

        // Group by calendar event ID
        const eventGroups = {};
        for (const booking of testBookings) {
            if (booking.calendarEventId) {
                if (!eventGroups[booking.calendarEventId]) {
                    eventGroups[booking.calendarEventId] = [];
                }
                eventGroups[booking.calendarEventId].push(booking);
            }
        }

        let duplicatesRemoved = 0;
        let htmlCleaned = 0;

        // Remove duplicates and clean HTML
        for (const [eventId, bookings] of Object.entries(eventGroups)) {
            if (bookings.length > 1) {
                console.log(`\n📦 Event ${eventId} has ${bookings.length} bookings:`);

                // Sort by creation time, keep the first one
                bookings.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                const keepBooking = bookings[0];
                const removeBookings = bookings.slice(1);

                // Clean HTML from the booking we're keeping
                if (keepBooking.customerName && keepBooking.customerName.includes('<')) {
                    const cleanName = keepBooking.customerName.replace(/<[^>]*>/g, '').trim();
                    await Booking.findByIdAndUpdate(keepBooking._id, { customerName: cleanName });
                    console.log(`   🧹 Cleaned HTML: "${keepBooking.customerName}" → "${cleanName}"`);
                    htmlCleaned++;
                }

                console.log(`   ✅ Keeping: ${keepBooking._id} (${keepBooking.createdAt.toLocaleString()})`);

                // Remove duplicates
                for (const duplicate of removeBookings) {
                    await Booking.findByIdAndDelete(duplicate._id);
                    console.log(`   🗑️ Removed: ${duplicate._id} (${duplicate.createdAt.toLocaleString()})`);
                    duplicatesRemoved++;
                }
            } else if (bookings.length === 1) {
                // Clean HTML from single bookings too
                const booking = bookings[0];
                if (booking.customerName && booking.customerName.includes('<')) {
                    const cleanName = booking.customerName.replace(/<[^>]*>/g, '').trim();
                    await Booking.findByIdAndUpdate(booking._id, { customerName: cleanName });
                    console.log(`🧹 Cleaned single booking HTML: "${booking.customerName}" → "${cleanName}"`);
                    htmlCleaned++;
                }
            }
        }

        console.log('\n📊 CLEANUP SUMMARY:');
        console.log(`Duplicates removed: ${duplicatesRemoved}`);
        console.log(`HTML names cleaned: ${htmlCleaned}`);
        console.log(`Total test bookings processed: ${testBookings.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📝 Disconnected from MongoDB');
    }
}

quickCleanup(); 