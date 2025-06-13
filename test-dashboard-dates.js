const fetch = require('node-fetch');

async function testDashboardDates() {
    console.log('🧪 Testing Dashboard Date Display...\n');

    try {
        // Test the API that the dashboard uses
        const response = await fetch('http://localhost:3001/api/booking');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.bookings) {
            console.log(`📊 Found ${data.bookings.length} total bookings\n`);

            // Find Tatiana's booking
            const tatianaBooking = data.bookings.find(b =>
                b.customerName && b.customerName.toLowerCase().includes('tatiana')
            );

            if (tatianaBooking) {
                console.log('🎯 Tatiana Booking Found:');
                console.log('📅 Start Date (raw):', tatianaBooking.startDate);
                console.log('🕐 Start Time:', tatianaBooking.startTime);
                console.log('🕑 End Time:', tatianaBooking.endTime);
                console.log('👤 Customer:', tatianaBooking.customerName);

                // Test how JavaScript will interpret this date
                const date = new Date(tatianaBooking.startDate);
                console.log('\n🌍 How this displays in different timezones:');
                console.log('🔸 UTC:', date.toISOString().split('T')[0]);
                console.log('🔸 Your timezone:', date.toLocaleDateString());
                console.log('🔸 Eastern Time:', date.toLocaleDateString('en-US', { timeZone: 'America/New_York' }));
                console.log('🔸 Pacific Time (LA):', date.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }));

                console.log('\n✅ Expected: July 28, 2025 (to match Google Calendar)');

                // Test the formatInTimeZone function that we're using in the dashboard
                const { formatInTimeZone } = require('date-fns-tz');
                const easternDate = formatInTimeZone(new Date(tatianaBooking.startDate), "America/New_York", "MMM d, yyyy");
                console.log('🎯 Dashboard will show:', easternDate);

            } else {
                console.log('❌ Tatiana booking not found in API response');

                // Show first few bookings for debugging
                console.log('\n🔍 First few bookings:');
                data.bookings.slice(0, 3).forEach((booking, idx) => {
                    console.log(`${idx + 1}. ${booking.customerName} - ${booking.startDate}`);
                });
            }
        } else {
            console.log('❌ No bookings data in API response');
        }

    } catch (error) {
        console.error('❌ Error testing dashboard:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the development server is running: npm run dev');
        }
    }
}

testDashboardDates(); 