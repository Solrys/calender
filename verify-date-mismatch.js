const fetch = require('node-fetch');

async function verifyDateMismatch() {
    console.log('🔍 Verifying Date Mismatch Between Database and Google Calendar\n');

    try {
        const response = await fetch('http://localhost:3001/api/booking');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.bookings) {
            console.log(`📊 Found ${data.bookings.length} total bookings\n`);

            // Find Lada Biesieda's booking (the one you showed in screenshot)
            const ladaBooking = data.bookings.find(b =>
                b.customerName && b.customerName.toLowerCase().includes('lada')
            );

            if (ladaBooking) {
                console.log('🎯 LADA BIESIEDA BOOKING ANALYSIS:');
                console.log('=======================================');
                console.log('📅 Raw Database Date:', ladaBooking.startDate);
                console.log('🕐 Start Time:', ladaBooking.startTime);
                console.log('🕑 End Time:', ladaBooking.endTime);
                console.log('🏢 Studio:', ladaBooking.studio);

                // Extract the database date
                const dbDate = new Date(ladaBooking.startDate);
                const dbDateStr = dbDate.toISOString().split('T')[0];

                console.log('\n🔍 DATE ANALYSIS:');
                console.log('🔸 Database stores:', dbDateStr);
                console.log('🔸 Dashboard should show:', dbDateStr);
                console.log('🔸 Google Calendar shows: 2025-08-10 (from your screenshot)');

                // Check if there's a mismatch
                if (dbDateStr === '2025-08-09' || dbDateStr.includes('08-09')) {
                    console.log('\n❌ CONFIRMED MISMATCH!');
                    console.log('🔸 Database: August 9, 2025');
                    console.log('🔸 Google Calendar: August 10, 2025');
                    console.log('🔸 Difference: Database is 1 day BEHIND');

                    console.log('\n🔧 REQUIRED FIX:');
                    console.log('✅ Add 1 day to database dates to match Google Calendar');
                } else {
                    console.log('\n🤔 DATE ANALYSIS UNCLEAR - showing raw data for investigation');
                }

            } else {
                console.log('❌ Lada Biesieda booking not found');

                // Show all bookings with names containing common letters
                console.log('\n🔍 Available bookings (sample):');
                data.bookings.slice(0, 10).forEach((booking, i) => {
                    const dateStr = new Date(booking.startDate).toISOString().split('T')[0];
                    console.log(`${i + 1}. ${booking.customerName || 'No Name'} - ${dateStr} (${booking.startTime})`);
                });
            }

            // Analysis of all calendar-synced bookings
            const calendarBookings = data.bookings.filter(b => b.calendarEventId);
            console.log(`\n📊 Calendar-synced bookings: ${calendarBookings.length}`);

            // Show pattern of dates
            console.log('\n📅 SAMPLE DATE PATTERN:');
            calendarBookings.slice(0, 5).forEach((booking, i) => {
                const dateStr = new Date(booking.startDate).toISOString().split('T')[0];
                console.log(`${i + 1}. ${booking.customerName || 'No Name'} - ${dateStr}`);
            });

        } else {
            console.log('❌ No bookings data found');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verifyDateMismatch(); 