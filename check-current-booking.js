const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkCurrentBooking() {
    console.log('🔍 Checking current test booking...\n');

    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db();
        const bookings = db.collection('bookings');

        // Find the most recent test booking
        const testBooking = await bookings.findOne(
            { customerName: 'test' },
            { sort: { createdAt: -1 } }
        );

        if (!testBooking) {
            console.log('❌ No test booking found');
            return;
        }

        console.log('📋 Current Test Booking:');
        console.log(`   🆔 ID: ${testBooking._id}`);
        console.log(`   📅 Start Date: ${testBooking.startDate}`);
        console.log(`   📅 Date String: ${new Date(testBooking.startDate).toISOString().split('T')[0]}`);
        console.log(`   🕐 Time: ${testBooking.startTime} - ${testBooking.endTime}`);
        console.log(`   🏢 Studio: ${testBooking.studio}`);
        console.log(`   💳 Payment Status: ${testBooking.paymentStatus}`);
        console.log(`   📝 Sync Version: ${testBooking.syncVersion || 'NOT SET'}`);
        console.log(`   🔧 Manual Handler: ${testBooking.processedWithManualHandler || false}`);
        console.log(`   📅 Calendar Event ID: ${testBooking.calendarEventId}`);
        console.log(`   ⏰ Created: ${testBooking.createdAt}`);

        // Check if this booking needs to be updated
        const needsUpdate = !testBooking.syncVersion ||
            !testBooking.syncVersion.includes('v2.5-date-timezone-fixed');

        if (needsUpdate) {
            console.log('\n🔧 Booking needs update - applying v2.5-date-timezone-fixed...');

            const updateResult = await bookings.updateOne(
                { _id: testBooking._id },
                {
                    $set: {
                        syncVersion: 'v2.5-date-timezone-fixed',
                        processedWithManualHandler: true,
                        lastSyncUpdate: new Date(),
                        migrationSafe: true
                    }
                }
            );

            if (updateResult.modifiedCount > 0) {
                console.log('✅ Booking updated successfully!');

                // Fetch the updated booking
                const updatedBooking = await bookings.findOne({ _id: testBooking._id });
                console.log('\n📋 Updated Booking:');
                console.log(`   📝 Sync Version: ${updatedBooking.syncVersion}`);
                console.log(`   🔧 Manual Handler: ${updatedBooking.processedWithManualHandler}`);
                console.log(`   📅 Last Sync Update: ${updatedBooking.lastSyncUpdate}`);
            } else {
                console.log('❌ Failed to update booking');
            }
        } else {
            console.log('\n✅ Booking already has correct sync version');
        }

        // Test the display logic
        console.log('\n🎯 Testing Display Logic:');
        const isManualBookingFixed = testBooking.paymentStatus === 'manual' &&
            testBooking.syncVersion && testBooking.syncVersion.includes('v2.5-date-timezone-fixed');

        console.log(`   Manual booking fixed: ${isManualBookingFixed}`);

        const needsCorrection = !isManualBookingFixed &&
            (!testBooking.syncVersion ||
                (!testBooking.syncVersion.includes('v3.1-date-corrected') &&
                    !testBooking.syncVersion.includes('v2.5-date-timezone-fixed')));

        console.log(`   Needs +1 day correction: ${needsCorrection}`);

        const dateStr = new Date(testBooking.startDate).toISOString().split('T')[0];
        console.log(`   Will display as: ${needsCorrection ? 'July 31st (+1 day)' : 'July 30th (correct)'}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

checkCurrentBooking(); 