const fetch = require('node-fetch');

async function verifyFreshImport() {
    console.log('🔍 VERIFICATION: Fresh Import vs Google Calendar Screenshots\n');

    try {
        const response = await fetch('http://localhost:3001/api/booking');
        const data = await response.json();

        console.log('📋 KEY BOOKINGS COMPARISON:\n');

        // Check Tatiana's booking
        const tatiana = data.bookings.find(b => b.customerName && b.customerName.toLowerCase().includes('tatiana'));
        if (tatiana) {
            const dateStr = new Date(tatiana.startDate).toISOString().split('T')[0];
            console.log('👤 TATIANA ST GERMAIN:');
            console.log(`   Database: ${dateStr} ${tatiana.startTime}-${tatiana.endTime}`);
            console.log('   Expected (Google): July 28, 11:00am-1:00pm');
            console.log(`   Status: ${dateStr === '2025-07-28' ? '✅ CORRECT' : '❌ WRONG - should be 2025-07-28'}\n`);
        }

        // Check Amanda's booking
        const amanda = data.bookings.find(b => b.customerName && b.customerName.toLowerCase().includes('amanda'));
        if (amanda) {
            const dateStr = new Date(amanda.startDate).toISOString().split('T')[0];
            console.log('👤 AMANDA PARADIZ:');
            console.log(`   Database: ${dateStr} ${amanda.startTime}-${amanda.endTime}`);
            console.log('   Expected (Google): September 27, 10:00am-1:00pm');
            console.log(`   Status: ${dateStr === '2025-09-27' ? '✅ CORRECT' : '❌ WRONG - should be 2025-09-27'}\n`);
        }

        // Check Lada's booking
        const lada = data.bookings.find(b => b.customerName && b.customerName.toLowerCase().includes('lada'));
        if (lada) {
            const dateStr = new Date(lada.startDate).toISOString().split('T')[0];
            console.log('👤 LADA BIESIEDA:');
            console.log(`   Database: ${dateStr} ${lada.startTime}-${lada.endTime}`);
            console.log('   Expected (Google): August 10, 4:00pm-8:00pm');
            console.log(`   Status: ${dateStr === '2025-08-10' ? '✅ CORRECT' : '❌ WRONG - should be 2025-08-10'}\n`);
        }

        console.log('🎯 SUMMARY:');
        console.log('If any dates are wrong, we need to add +1 day to those specific bookings');
        console.log('The fresh import is using the timezone-converted dates from Google Calendar API');

    } catch (error) {
        console.error('❌ Error verifying fresh import:', error.message);
    }
}

verifyFreshImport(); 