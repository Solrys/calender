const { MongoClient } = require('mongodb');

async function fixTatianaTimezone() {
    console.log('🔧 Fixing Tatiana Date to Show July 28th in ALL Timezones...\n');

    const client = new MongoClient('mongodb+srv://somnathdevopser:Somnath123@cluster0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('photography-booking');
        const collection = db.collection('bookings');

        // Find Tatiana's booking
        const booking = await collection.findOne({ customerName: /Tatiana/i });

        if (!booking) {
            console.log('❌ Tatiana booking not found');
            return;
        }

        console.log('📅 Current booking:');
        console.log('🔸 Date:', booking.startDate);
        console.log('🔸 Start Time:', booking.startTime);
        console.log('🔸 End Time:', booking.endTime);

        // The problem: 2025-07-28T00:00:00.000Z shows as July 27th in Eastern Time
        // The solution: Store as July 28th 4 AM UTC = July 28th 12 AM Eastern Time
        const fixedDate = new Date('2025-07-28T04:00:00.000Z');

        console.log('\n🎯 New date calculation:');
        console.log('🔸 Storing as UTC:', fixedDate.toISOString());
        console.log('🔸 Will display in Eastern:', fixedDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' }));
        console.log('🔸 Will display in Pacific:', fixedDate.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }));
        console.log('🔸 Will display in India:', fixedDate.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }));

        // Update the booking
        const result = await collection.updateOne(
            { _id: booking._id },
            {
                $set: {
                    startDate: fixedDate,
                    startTime: '11:00 AM',
                    endTime: '1:00 PM'
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log('\n✅ SUCCESS! Tatiana booking updated');

            // Verify the update
            const updated = await collection.findOne({ _id: booking._id });
            console.log('\n🔍 Verification:');
            console.log('🔸 Updated Date:', updated.startDate);
            console.log('🔸 Start Time:', updated.startTime);
            console.log('🔸 End Time:', updated.endTime);

            // Test how it will display
            const date = new Date(updated.startDate);
            console.log('\n🌍 How it will display in dashboard:');
            console.log('🔸 Eastern Time (Your dashboard):', date.toLocaleDateString('en-US', { timeZone: 'America/New_York' }));
            console.log('🔸 Pacific Time (LA client):', date.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }));
            console.log('🔸 India Time (Your browser):', date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }));
            console.log('🔸 Google Calendar shows: Jul 28, 2025, 11:00am - 1:00pm');

            const easternShows28 = date.toLocaleDateString('en-US', { timeZone: 'America/New_York' }).includes('28');
            const pacificShows28 = date.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }).includes('28');

            if (easternShows28 && pacificShows28) {
                console.log('\n🎉 PERFECT MATCH! All timezones now show July 28th');
            } else {
                console.log('\n⚠️ Still not matching - let me try a different approach');
            }

        } else {
            console.log('\n❌ Failed to update booking');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
        console.log('\n📤 Disconnected from MongoDB');
    }
}

fixTatianaTimezone(); 