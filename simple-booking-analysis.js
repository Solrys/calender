const { MongoClient } = require('mongodb');
require('dotenv').config();

async function analyzeTestBooking() {
    console.log('🔍 SIMPLE BOOKING ANALYSIS');
    console.log('='.repeat(50));

    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db();
        const bookings = db.collection('bookings');

        // 1. CHECK DATABASE
        console.log('\n📊 1. DATABASE ANALYSIS');
        console.log('-'.repeat(30));

        const testBooking = await bookings.findOne(
            { customerName: 'test' },
            { sort: { createdAt: -1 } }
        );

        if (!testBooking) {
            console.log('❌ No test booking found in database');
            return;
        }

        console.log('📋 Database Record:');
        console.log(`   🆔 ID: ${testBooking._id}`);
        console.log(`   👤 Customer: ${testBooking.customerName}`);
        console.log(`   🏢 Studio: ${testBooking.studio}`);
        console.log(`   📅 Start Date (Raw): ${testBooking.startDate}`);
        console.log(`   📅 Start Date (ISO): ${new Date(testBooking.startDate).toISOString()}`);
        console.log(`   📅 Date String: ${new Date(testBooking.startDate).toISOString().split('T')[0]}`);
        console.log(`   🕐 Start Time: ${testBooking.startTime}`);
        console.log(`   🕐 End Time: ${testBooking.endTime}`);
        console.log(`   💳 Payment Status: ${testBooking.paymentStatus}`);
        console.log(`   📝 Sync Version: ${testBooking.syncVersion || 'NOT SET'}`);
        console.log(`   🔧 Manual Handler: ${testBooking.processedWithManualHandler || false}`);
        console.log(`   📅 Calendar Event ID: ${testBooking.calendarEventId}`);
        console.log(`   ⏰ Created At: ${testBooking.createdAt}`);

        // 2. SIMULATE DASHBOARD DISPLAY LOGIC
        console.log('\n🖥️  2. DASHBOARD DISPLAY ANALYSIS');
        console.log('-'.repeat(30));

        // Current logic from Dashboard.js
        const isoDate = new Date(testBooking.startDate).toISOString();
        const datePart = isoDate.split('T')[0];
        const [year, month, day] = datePart.split('-');

        console.log('📊 Current Display Logic:');
        console.log(`   📅 ISO Date: ${isoDate}`);
        console.log(`   📅 Date Part: ${datePart}`);
        console.log(`   📅 Year: ${year}, Month: ${month}, Day: ${day}`);

        // Check sync version logic (CURRENT LOGIC)
        const isNewFixedBooking = testBooking.syncVersion === 'v2.5-date-timezone-fixed';
        const needsCorrection = !isNewFixedBooking &&
            (!testBooking.syncVersion ||
                !testBooking.syncVersion.includes('v3.1-date-corrected'));

        console.log(`   🔧 Is New Fixed Booking: ${isNewFixedBooking}`);
        console.log(`   ⚠️  Needs Correction: ${needsCorrection}`);

        if (needsCorrection) {
            const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
            correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
            const localDate = new Date(correctedDate.getUTCFullYear(), correctedDate.getUTCMonth(), correctedDate.getUTCDate());

            // Format like the actual Dashboard.js does
            const displayDate = localDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            console.log(`   📅 Will Display As: ${displayDate} (+1 day correction applied)`);
        } else {
            const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const displayDate = localDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            console.log(`   📅 Will Display As: ${displayDate} (no correction)`);
        }

        // 3. SIMULATE BLOCKING LOGIC
        console.log('\n🚫 3. TIME BLOCKING ANALYSIS');
        console.log('-'.repeat(30));

        // Simulate the blocking logic from bookingHelpers.js
        const blockingDatePart = new Date(testBooking.startDate).toISOString().split('T')[0];
        const isNewFixedBookingBlocking = testBooking.syncVersion === 'v2.5-date-timezone-fixed';
        const needsCorrectionBlocking = !isNewFixedBookingBlocking &&
            (!testBooking.syncVersion ||
                !testBooking.syncVersion.includes('v3.1-date-corrected'));

        let blockingDateKey;
        if (needsCorrectionBlocking) {
            const [bYear, bMonth, bDay] = blockingDatePart.split('-');
            const correctedDate = new Date(`${bYear}-${bMonth}-${bDay}T12:00:00.000Z`);
            correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
            blockingDateKey = correctedDate.toISOString().split('T')[0];
            console.log(`   📅 Will Block Date: ${blockingDateKey} (+1 day correction applied)`);
        } else {
            blockingDateKey = blockingDatePart;
            console.log(`   📅 Will Block Date: ${blockingDateKey} (no correction)`);
        }

        // 4. PROBLEM DIAGNOSIS
        console.log('\n🔍 4. PROBLEM DIAGNOSIS');
        console.log('-'.repeat(30));

        console.log('🔍 Issue Analysis:');
        if (testBooking.syncVersion === 'v2.5-date-timezone-fixed') {
            console.log('   ✅ Booking has the correct sync version');
            console.log('   ✅ Should display without +1 day correction');
            if (datePart === '2025-07-30') {
                console.log('   ✅ Database has correct date (July 30th)');
                console.log('   ❓ If dashboard shows July 31st, there might be a frontend issue');
            } else {
                console.log(`   ❌ Database has wrong date: ${datePart}`);
            }
        } else {
            console.log('   ❌ Booking does NOT have the v2.5-date-timezone-fixed sync version');
            console.log('   ❌ Will be treated as old booking and get +1 day correction');
            console.log('   💡 This explains why it shows July 31st instead of July 30th');
        }

        // 5. SOLUTION
        console.log('\n🛠️  5. SOLUTION');
        console.log('-'.repeat(30));

        if (testBooking.syncVersion !== 'v2.5-date-timezone-fixed') {
            console.log('🔧 IMMEDIATE FIX: Update this booking with correct sync version');

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
                console.log('✅ This booking should now display as July 30th');
                console.log('✅ Refresh your dashboard to see the change');
            } else {
                console.log('❌ Failed to update booking');
            }
        } else {
            console.log('✅ Booking already has correct sync version');
            console.log('🔍 Check if there are other issues:');
            console.log('   1. Clear browser cache and refresh');
            console.log('   2. Check if formatDateForDisplay function is being used correctly');
            console.log('   3. Verify no other logic is overriding the display');
        }

        console.log('\n📋 NEXT STEPS FOR NEW MANUAL BOOKINGS:');
        console.log('1. Create a new manual calendar event for July 30th');
        console.log('2. The webhook should process it with syncVersion: v2.5-date-timezone-fixed');
        console.log('3. It should display correctly as July 30th in the dashboard');
        console.log('4. All existing bookings will remain unchanged');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

analyzeTestBooking(); 