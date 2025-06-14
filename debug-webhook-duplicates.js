// Debug and Clean Up Webhook Duplicates
const { MongoClient } = require('mongodb');
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

async function debugWebhookDuplicates() {
    console.log('🔍 DEBUGGING WEBHOOK DUPLICATE BOOKINGS');
    console.log('='.repeat(60));

    let client;
    try {
        // Connect to MongoDB
        client = new MongoClient(env.MONGODB_URI);
        await client.connect();
        const db = client.db();
        const bookings = db.collection('bookings');

        console.log('✅ Connected to MongoDB');

        // Find recent test bookings (from today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const recentBookings = await bookings.find({
            createdAt: { $gte: today },
            customerName: 'test',
            customerEmail: 'test@example.com'
        }).sort({ createdAt: -1 }).toArray();

        console.log(`\n📊 Found ${recentBookings.length} recent test bookings created today`);

        if (recentBookings.length === 0) {
            console.log('No recent test bookings found');
            return;
        }

        // Group by calendar event ID
        const eventGroups = {};
        recentBookings.forEach(booking => {
            const eventId = booking.calendarEventId || 'no-event-id';
            if (!eventGroups[eventId]) {
                eventGroups[eventId] = [];
            }
            eventGroups[eventId].push(booking);
        });

        console.log(`\n📋 Bookings grouped by Calendar Event ID:`);
        console.log('='.repeat(60));

        let totalDuplicates = 0;
        let duplicatesToDelete = [];

        for (const [eventId, bookingGroup] of Object.entries(eventGroups)) {
            console.log(`\n🆔 Event ID: ${eventId}`);
            console.log(`   📊 Number of bookings: ${bookingGroup.length}`);

            if (bookingGroup.length > 1) {
                console.log(`   ⚠️ DUPLICATES DETECTED!`);
                totalDuplicates += bookingGroup.length - 1;

                // Sort by creation time, keep the first one
                bookingGroup.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                const keepBooking = bookingGroup[0];
                const deleteBookings = bookingGroup.slice(1);

                console.log(`   ✅ KEEPING: ${keepBooking._id} (${keepBooking.startDate.toISOString().split('T')[0]} ${keepBooking.startTime})`);

                deleteBookings.forEach((booking, index) => {
                    console.log(`   ❌ DELETE: ${booking._id} (${booking.startDate.toISOString().split('T')[0]} ${booking.startTime})`);
                    duplicatesToDelete.push(booking._id);
                });
            } else {
                const booking = bookingGroup[0];
                console.log(`   ✅ SINGLE: ${booking._id} (${booking.startDate.toISOString().split('T')[0]} ${booking.startTime})`);
            }

            // Show details of first booking
            const firstBooking = bookingGroup[0];
            console.log(`   📅 Date: ${firstBooking.startDate.toISOString().split('T')[0]}`);
            console.log(`   🕐 Time: ${firstBooking.startTime} - ${firstBooking.endTime}`);
            console.log(`   🏢 Studio: ${firstBooking.studio}`);
            console.log(`   👤 Customer: ${firstBooking.customerName}`);
            console.log(`   📧 Email: ${firstBooking.customerEmail}`);
            console.log(`   📱 Phone: ${firstBooking.customerPhone}`);
            console.log(`   💳 Payment: ${firstBooking.paymentStatus}`);
            console.log(`   🔧 Handler: ${firstBooking.processedWithManualHandler ? 'Manual Handler' : 'Original'}`);
            console.log(`   📝 Version: ${firstBooking.syncVersion || 'No version'}`);
        }

        console.log(`\n📊 SUMMARY:`);
        console.log(`   Total recent test bookings: ${recentBookings.length}`);
        console.log(`   Unique calendar events: ${Object.keys(eventGroups).length}`);
        console.log(`   Duplicate bookings found: ${totalDuplicates}`);
        console.log(`   Bookings to delete: ${duplicatesToDelete.length}`);

        if (duplicatesToDelete.length > 0) {
            console.log(`\n🧹 CLEANING UP DUPLICATES...`);

            const deleteResult = await bookings.deleteMany({
                _id: { $in: duplicatesToDelete }
            });

            console.log(`✅ Deleted ${deleteResult.deletedCount} duplicate bookings`);

            // Verify cleanup
            const remainingBookings = await bookings.find({
                createdAt: { $gte: today },
                customerName: 'test',
                customerEmail: 'test@example.com'
            }).toArray();

            console.log(`📊 Remaining test bookings: ${remainingBookings.length}`);
        }

        // Check for any bookings with wrong dates (not July 30)
        console.log(`\n🔍 CHECKING FOR TIMEZONE ISSUES...`);
        const wrongDateBookings = recentBookings.filter(booking => {
            const bookingDate = booking.startDate.toISOString().split('T')[0];
            return bookingDate !== '2025-07-30'; // Expected date
        });

        if (wrongDateBookings.length > 0) {
            console.log(`⚠️ Found ${wrongDateBookings.length} bookings with wrong dates:`);
            wrongDateBookings.forEach(booking => {
                console.log(`   ❌ ${booking._id}: ${booking.startDate.toISOString().split('T')[0]} ${booking.startTime} (should be 2025-07-30)`);
            });
        } else {
            console.log(`✅ All remaining bookings have correct dates`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Run the debug script
console.log('🚀 Starting Webhook Duplicate Debug...\n');
debugWebhookDuplicates()
    .then(() => console.log('\n🏁 Debug completed!'))
    .catch(console.error); 