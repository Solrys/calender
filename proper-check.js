const fetch = require('node-fetch');

async function properVerification() {
    console.log('🔍 PROPER VERIFICATION - Current State\n');

    try {
        const response = await fetch('http://localhost:3001/api/booking');
        const data = await response.json();

        // Check Tatiana's booking
        const tatiana = data.bookings.find(b => b.customerName && b.customerName.toLowerCase().includes('tatiana'));
        if (tatiana) {
            console.log('📅 TATIANA ST GERMAIN:');
            console.log('  Database Date:', new Date(tatiana.startDate).toISOString().split('T')[0]);
            console.log('  Database Times:', tatiana.startTime + ' - ' + tatiana.endTime);
            console.log('  Expected (Google Calendar): July 28, 11:00am - 1:00pm');

            if (new Date(tatiana.startDate).toISOString().split('T')[0] === '2025-07-29') {
                console.log('  ❌ ERROR: Database shows July 29 but Google shows July 28');
                console.log('  ❌ We OVERCORRECTED by 1 day!');
            }

            if (tatiana.startTime !== '11:00 AM' || tatiana.endTime !== '1:00 PM') {
                console.log('  ❌ ERROR: Times are wrong! Should be 11:00 AM - 1:00 PM');
            }
        }

        // Check a few more bookings
        const amanda = data.bookings.find(b => b.customerName && b.customerName.toLowerCase().includes('amanda'));
        if (amanda) {
            console.log('\n📅 AMANDA PARADIZ:');
            console.log('  Database Date:', new Date(amanda.startDate).toISOString().split('T')[0]);
            console.log('  Database Times:', amanda.startTime + ' - ' + amanda.endTime);
            console.log('  Expected (Google Calendar): Sept 27, 10:00am - 1:00pm');
        }

        const lada = data.bookings.find(b => b.customerName && b.customerName.toLowerCase().includes('lada'));
        if (lada) {
            console.log('\n📅 LADA BIESIEDA:');
            console.log('  Database Date:', new Date(lada.startDate).toISOString().split('T')[0]);
            console.log('  Database Times:', lada.startTime + ' - ' + lada.endTime);
            console.log('  Expected (Google Calendar): August 10, 1:00pm - 5:00pm');
        }

        console.log('\n🔍 CONCLUSION:');
        console.log('We need to:');
        console.log('1. Fix dates that are now 1 day AHEAD (subtract 1 day)');
        console.log('2. Fix times to match Google Calendar exactly');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

properVerification(); 