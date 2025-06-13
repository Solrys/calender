const mongoose = require('mongoose');
require('dotenv').config();

async function fixTatianaDateProperly() {
    console.log('🔧 Fixing Tatiana Date to Display July 28th in ALL Timezones...\n');

    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find Tatiana's booking
        const Booking = require('./src/models/Booking');
        const booking = await Booking.findOne({ customerName: /Tatiana/i });

        if (!booking) {
            console.log('❌ Tatiana booking not found');
            return;
        }

        console.log('📅 Current booking:');
        console.log('🔸 Date:', booking.startDate);
        console.log('🔸 Start Time:', booking.startTime);
        console.log('🔸 End Time:', booking.endTime);

        // The problem: 2025-07-28T00:00:00.000Z converts to July 27th in Eastern Time
        // The solution: Store as July 28th 4 AM UTC = July 28th 12 AM Eastern Time
        const fixedDate = new Date('2025-07-28T04:00:00.000Z');

        console.log('\n🎯 New date calculation:');
        console.log('🔸 Storing as UTC:', fixedDate.toISOString());
        console.log('🔸 Will display in Eastern:', fixedDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' }));
        console.log('🔸 Will display in Pacific:', fixedDate.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }));
        console.log('🔸 Will display in India:', fixedDate.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }));

        // Update the booking
        const result = await Booking.updateOne(
            { _id: booking._id },
            {
                startDate: fixedDate,
                // Ensure times match Google Calendar exactly
                startTime: '11:00 AM',
                endTime: '1:00 PM'
            }
        );

        if (result.modifiedCount > 0) {
            console.log('\n✅ SUCCESS! Tatiana booking updated');

            // Verify the update
            const updated = await Booking.findById(booking._id);
            console.log('\n🔍 Verification:');
            console.log('🔸 Updated Date:', updated.startDate);
            console.log('🔸 Start Time:', updated.startTime);
            console.log('🔸 End Time:', updated.endTime);

            // Test formatInTimeZone function
            const { formatInTimeZone } = require('date-fns-tz');
            const easternDate = formatInTimeZone(updated.startDate, "America/New_York", "MMM d, yyyy");
            const pacificDate = formatInTimeZone(updated.startDate, "America/Los_Angeles", "MMM d, yyyy");

            console.log('\n🌍 How it will display in dashboard:');
            console.log('🔸 Eastern Time (Your dashboard):', easternDate);
            console.log('🔸 Pacific Time (LA client):', pacificDate);
            console.log('🔸 Google Calendar shows: Jul 28, 2025, 11:00am - 1:00pm');

            if (easternDate.includes('28') && pacificDate.includes('28')) {
                console.log('\n🎉 PERFECT MATCH! All timezones now show July 28th');
            } else {
                console.log('\n⚠️ Still not matching - may need different approach');
            }

        } else {
            console.log('\n❌ Failed to update booking');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📤 Disconnected from MongoDB');
    }
}

fixTatianaDateProperly(); 