const fetch = require('node-fetch');

async function debugBookingFlow() {
    console.log('🔍 DEBUG: Complete Booking Flow Analysis');
    console.log('==========================================');

    try {
        // Get all bookings
        const response = await fetch('http://localhost:3001/api/booking');
        const data = await response.json();

        console.log(`\n📊 TOTAL BOOKINGS: ${data.bookings.length}\n`);

        // Analyze different types of bookings
        const newBookings = data.bookings.filter(b =>
            b.syncVersion && (
                b.syncVersion.includes('new-booking') ||
                b.syncVersion.includes('calendar-database-synced')
            )
        );

        const correctedBookings = data.bookings.filter(b =>
            b.syncVersion && b.syncVersion.includes('date-corrected')
        );

        const freshImportBookings = data.bookings.filter(b =>
            b.syncVersion && b.syncVersion.includes('fresh-start')
        );

        const oldBookings = data.bookings.filter(b => !b.syncVersion);

        console.log('📋 BOOKING CATEGORIES:');
        console.log(`   🆕 New Bookings (after fix): ${newBookings.length}`);
        console.log(`   🔧 Corrected Bookings: ${correctedBookings.length}`);
        console.log(`   🔄 Fresh Import Bookings: ${freshImportBookings.length}`);
        console.log(`   📰 Old Bookings (no version): ${oldBookings.length}`);

        // Check recent bookings
        const recentBookings = data.bookings
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        console.log('\n🕒 LAST 5 BOOKINGS:');
        recentBookings.forEach((booking, index) => {
            const dateStr = new Date(booking.startDate).toISOString().split('T')[0];
            console.log(`   ${index + 1}. ${booking.customerName || 'No name'}`);
            console.log(`      Date: ${dateStr} | Time: ${booking.startTime}-${booking.endTime}`);
            console.log(`      Version: ${booking.syncVersion || 'Not set'}`);
            console.log(`      Created: ${new Date(booking.createdAt).toLocaleString()}`);
            console.log('');
        });

        // Check for date patterns
        console.log('🎯 RECOMMENDED TESTING:');
        console.log('1. Make a new booking for a specific date (e.g., July 20)');
        console.log('2. Note what date you selected on the website');
        console.log('3. Complete payment and check:');
        console.log('   - Dashboard shows which date?');
        console.log('   - Google Calendar shows which date?');
        console.log('   - Booking system blocks which date?');
        console.log('4. Run this script again to see the sync version');

        if (newBookings.length > 0) {
            console.log('\n✅ Good! You have new bookings with timezone fixes applied');
        } else {
            console.log('\n⚠️ No new bookings with fixes detected yet. Make a test booking!');
        }

    } catch (error) {
        console.error('❌ Error debugging booking flow:', error.message);
    }
}

debugBookingFlow(); 