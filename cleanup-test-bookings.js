// Clean up all test bookings to start fresh
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

async function cleanupTestBookings() {
    console.log('🧹 CLEANING UP TEST BOOKINGS');
    console.log('='.repeat(50));

    let client;
    try {
        // Connect to MongoDB
        client = new MongoClient(env.MONGODB_URI);
        await client.connect();
        const db = client.db();
        const bookings = db.collection('bookings');

        console.log('✅ Connected to MongoDB');

        // Find all test bookings
        const testBookings = await bookings.find({
            customerName: 'test',
            customerEmail: 'test@example.com',
            customerPhone: '305-123-1111'
        }).toArray();

        console.log(`\n📊 Found ${testBookings.length} test bookings to clean up`);

        if (testBookings.length === 0) {
            console.log('No test bookings found');
            return;
        }

        // Show what will be deleted
        console.log('\n📋 Test bookings to be deleted:');
        testBookings.forEach((booking, index) => {
            console.log(`   ${index + 1}. ${booking._id} - ${booking.startDate.toISOString().split('T')[0]} ${booking.startTime} (${booking.studio})`);
        });

        // Delete all test bookings
        const deleteResult = await bookings.deleteMany({
            customerName: 'test',
            customerEmail: 'test@example.com',
            customerPhone: '305-123-1111'
        });

        console.log(`\n✅ Deleted ${deleteResult.deletedCount} test bookings`);
        console.log('🎯 Database is now clean and ready for fresh testing');

        // Verify cleanup
        const remainingTestBookings = await bookings.find({
            customerName: 'test',
            customerEmail: 'test@example.com'
        }).toArray();

        if (remainingTestBookings.length === 0) {
            console.log('✅ Cleanup verified: No test bookings remain');
        } else {
            console.log(`⚠️ Warning: ${remainingTestBookings.length} test bookings still exist`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Run the cleanup
console.log('🚀 Starting Test Booking Cleanup...\n');
cleanupTestBookings()
    .then(() => {
        console.log('\n🏁 Cleanup completed!');
        console.log('\n💡 Next steps:');
        console.log('   1. Create a NEW manual event in Google Calendar');
        console.log('   2. Use July 30, 2025 at 3:00-4:00 PM');
        console.log('   3. Check if only ONE booking is created with correct date/time');
    })
    .catch(console.error); 