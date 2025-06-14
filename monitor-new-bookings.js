// Real-time monitoring of new bookings
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

async function monitorNewBookings() {
    console.log('👀 MONITORING NEW BOOKINGS IN REAL-TIME');
    console.log('='.repeat(60));
    console.log('💡 Create a manual Google Calendar event now and watch for new bookings...');
    console.log('🔄 Checking every 5 seconds. Press Ctrl+C to stop.\n');

    let client;
    let lastCheckTime = new Date();

    try {
        // Connect to MongoDB
        client = new MongoClient(env.MONGODB_URI);
        await client.connect();
        const db = client.db();
        const bookings = db.collection('bookings');

        console.log('✅ Connected to MongoDB');
        console.log(`🕐 Starting monitoring at: ${lastCheckTime.toISOString()}\n`);

        // Monitor for new bookings
        const checkInterval = setInterval(async () => {
            try {
                const currentTime = new Date();

                // Find bookings created since last check
                const newBookings = await bookings.find({
                    createdAt: { $gte: lastCheckTime },
                    customerName: 'test'
                }).sort({ createdAt: -1 }).toArray();

                if (newBookings.length > 0) {
                    console.log(`\n🚨 ${newBookings.length} NEW BOOKING(S) DETECTED!`);
                    console.log('='.repeat(50));

                    newBookings.forEach((booking, index) => {
                        console.log(`\n📋 BOOKING ${index + 1}:`);
                        console.log(`   🆔 ID: ${booking._id}`);
                        console.log(`   📅 Date: ${booking.startDate.toISOString().split('T')[0]}`);
                        console.log(`   🕐 Time: ${booking.startTime} - ${booking.endTime}`);
                        console.log(`   🏢 Studio: ${booking.studio}`);
                        console.log(`   👤 Customer: ${booking.customerName}`);
                        console.log(`   📧 Email: ${booking.customerEmail}`);
                        console.log(`   📱 Phone: ${booking.customerPhone}`);
                        console.log(`   💳 Payment: ${booking.paymentStatus}`);
                        console.log(`   🔧 Handler: ${booking.processedWithManualHandler ? 'Manual Handler ✅' : 'Original Handler ❌'}`);
                        console.log(`   📝 Version: ${booking.syncVersion || 'No version'}`);
                        console.log(`   🆔 Calendar Event ID: ${booking.calendarEventId}`);
                        console.log(`   ⏰ Created: ${booking.createdAt.toISOString()}`);

                        // Validate the booking
                        const expectedDate = '2025-07-30';
                        const expectedTime = '3:00 PM';
                        const isCorrect = (
                            booking.startDate.toISOString().split('T')[0] === expectedDate &&
                            booking.startTime === expectedTime &&
                            booking.processedWithManualHandler === true
                        );

                        if (isCorrect) {
                            console.log(`   ✅ VALIDATION: Booking looks correct!`);
                        } else {
                            console.log(`   ❌ VALIDATION: Issues detected:`);
                            if (booking.startDate.toISOString().split('T')[0] !== expectedDate) {
                                console.log(`      - Wrong date: ${booking.startDate.toISOString().split('T')[0]} (expected ${expectedDate})`);
                            }
                            if (booking.startTime !== expectedTime) {
                                console.log(`      - Wrong time: ${booking.startTime} (expected ${expectedTime})`);
                            }
                            if (!booking.processedWithManualHandler) {
                                console.log(`      - Used old handler instead of fixed manual handler`);
                            }
                        }
                    });

                    console.log(`\n📊 SUMMARY:`);
                    console.log(`   Total new bookings: ${newBookings.length}`);

                    // Check for duplicates
                    const eventIds = newBookings.map(b => b.calendarEventId);
                    const uniqueEventIds = [...new Set(eventIds)];

                    if (eventIds.length > uniqueEventIds.length) {
                        console.log(`   ⚠️ DUPLICATES: ${eventIds.length - uniqueEventIds.length} duplicate bookings detected!`);
                    } else {
                        console.log(`   ✅ NO DUPLICATES: All bookings have unique calendar event IDs`);
                    }

                    console.log(`\n🔄 Continuing to monitor...`);
                }

                lastCheckTime = currentTime;

            } catch (error) {
                console.error('❌ Error checking for new bookings:', error.message);
            }
        }, 5000); // Check every 5 seconds

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Stopping monitoring...');
            clearInterval(checkInterval);
            if (client) {
                client.close();
            }
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        if (client) {
            await client.close();
        }
    }
}

// Run the monitor
console.log('🚀 Starting Real-time Booking Monitor...\n');
monitorNewBookings().catch(console.error); 