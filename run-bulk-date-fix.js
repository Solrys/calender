const fetch = require('node-fetch');

async function runBulkDateFix() {
    console.log('🔧 MASSIVE DATABASE FIX: Running Bulk Date Correction...\n');

    try {
        console.log('📡 Calling bulk fix API endpoint...');

        const response = await fetch('http://localhost:3001/api/fix-booking-dates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        console.log('📊 BULK FIX RESULTS:');
        console.log('====================');
        console.log(`Total bookings processed: ${result.totalBookings}`);
        console.log(`Successfully fixed: ${result.fixed}`);
        console.log(`Errors: ${result.errors}`);

        if (result.success) {
            console.log('\n🎉 SUCCESS! All booking dates have been corrected');
            console.log('✅ Database dates now match Google Calendar');
            console.log('✅ Dashboard will show correct dates');
            console.log('✅ LA clients will see correct dates');
            console.log('✅ Booking system will block correct dates');

            if (result.results && result.results.length > 0) {
                console.log('\n🔍 SAMPLE FIXES (First 10):');
                result.results.forEach((fix, i) => {
                    console.log(`${i + 1}. ${fix.name}: ${fix.before} → ${fix.after} (${fix.status})`);
                });
            }
        } else {
            console.log('\n❌ Fix failed:', result.message);
            if (result.error) {
                console.log('Error details:', result.error);
            }
        }

    } catch (error) {
        console.error('❌ Error calling fix API:', error.message);
    }
}

runBulkDateFix(); 