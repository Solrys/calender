const fetch = require('node-fetch');

async function testNewBookingFix() {
    console.log('🧪 TESTING: New Booking Timezone Fix');
    console.log('=====================================');

    try {
        // Check latest booking in database
        const response = await fetch('http://localhost:3001/api/booking');
        const data = await response.json();

        // Find the most recent booking (highest ID or latest createdAt)
        const latestBooking = data.bookings
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

        if (!latestBooking) {
            console.log('❌ No bookings found');
            return;
        }

        console.log('📋 LATEST BOOKING:');
        console.log(`   Customer: ${latestBooking.customerName || 'No name'}`);
        console.log(`   Studio: ${latestBooking.studio}`);
        const dateStr = new Date(latestBooking.startDate).toISOString().split('T')[0];
        console.log(`   Database Date: ${dateStr}`);
        console.log(`   Database Time: ${latestBooking.startTime} - ${latestBooking.endTime}`);
        console.log(`   Payment Status: ${latestBooking.paymentStatus}`);
        console.log(`   Calendar Event ID: ${latestBooking.calendarEventId || 'None'}`);
        console.log(`   Sync Version: ${latestBooking.syncVersion || 'Not set'}`);
        console.log(`   Created: ${new Date(latestBooking.createdAt).toLocaleString()}`);

        console.log('\n🎯 INSTRUCTIONS FOR TESTING:');
        console.log('1. Make a new booking on the website');
        console.log('2. Complete the payment process');
        console.log('3. Check Google Calendar - it should show the same date as dashboard');
        console.log('4. Run this script again to see the corrected booking data');

        // Check if this is a corrected booking
        if (latestBooking.syncVersion && latestBooking.syncVersion.includes('new-booking-corrected')) {
            console.log('\n✅ This booking appears to have the NEW timezone correction applied!');
        } else if (latestBooking.syncVersion && latestBooking.syncVersion.includes('date-corrected')) {
            console.log('\n✅ This booking appears to be from the bulk date correction');
        } else {
            console.log('\n⚠️ This booking may not have timezone correction applied');
        }

    } catch (error) {
        console.error('❌ Error testing new booking fix:', error.message);
    }
}

testNewBookingFix(); 