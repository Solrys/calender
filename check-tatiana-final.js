const { MongoClient } = require('mongodb');

async function checkTatianaFinal() {
    const client = new MongoClient('mongodb+srv://somnathdevopser:Somnath123@cluster0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

    try {
        await client.connect();
        const db = client.db('photography-booking');
        const collection = db.collection('bookings');

        const booking = await collection.findOne({ customerName: /Tatiana/i });

        if (booking) {
            console.log('📅 Tatiana Database Record:');
            console.log('🔸 Start Date:', booking.startDate);
            console.log('🔸 Start Time:', booking.startTime);
            console.log('🔸 End Time:', booking.endTime);
            console.log('🔸 Customer:', booking.customerName);

            // Show how it would display in different timezones
            const date = new Date(booking.startDate);
            console.log('\n🌍 How this date displays:');
            console.log('🔸 UTC:', date.toISOString());
            console.log('🔸 Local (your timezone):', date.toLocaleDateString());
            console.log('🔸 Eastern Time:', date.toLocaleDateString('en-US', { timeZone: 'America/New_York' }));
            console.log('🔸 Pacific Time:', date.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }));
        } else {
            console.log('❌ No booking found for Tatiana');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
    }
}

checkTatianaFinal(); 