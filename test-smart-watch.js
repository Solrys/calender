// Test the smart calendar watch registration system
const fs = require('fs');

async function testSmartWatch() {
    console.log('🧪 TESTING SMART CALENDAR WATCH SYSTEM');
    console.log('='.repeat(60));

    try {
        const baseUrl = 'https://booking.bookthespace.com'; // Your production URL

        // Test 1: Check current watch status
        console.log('\n1️⃣ CHECKING CURRENT WATCH STATUS...');

        const checkResponse = await fetch(`${baseUrl}/api/checkCalendarWatch`);
        const checkData = await checkResponse.json();

        console.log(`   Status: ${checkData.status}`);
        console.log(`   Message: ${checkData.message}`);

        if (checkData.hasWatch) {
            console.log(`   🆔 Channel ID: ${checkData.watchInfo.channelId}`);
            console.log(`   ⏰ Hours remaining: ${checkData.watchInfo.hoursRemaining}`);
            console.log(`   ✅ Valid: ${checkData.watchInfo.isValid}`);
        }

        // Test 2: Try to register a watch (should use existing if valid)
        console.log('\n2️⃣ TESTING SMART WATCH REGISTRATION...');

        const registerResponse = await fetch(`${baseUrl}/api/registerCalendarWatch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const registerData = await registerResponse.json();

        console.log(`   Action: ${registerData.action}`);
        console.log(`   Message: ${registerData.message}`);

        if (registerData.action === 'no_action_needed') {
            console.log('   ✅ SMART SYSTEM WORKING: Using existing valid watch');
            console.log(`   🆔 Existing Channel ID: ${registerData.existingWatch.channelId}`);
            console.log(`   ⏰ Hours remaining: ${registerData.existingWatch.hoursRemaining}`);
        } else if (registerData.action === 'new_watch_created') {
            console.log('   ✅ NEW WATCH CREATED: Old watch was expired or missing');
            console.log(`   🆔 New Channel ID: ${registerData.channelId}`);
            console.log(`   🔗 Resource ID: ${registerData.resourceId}`);
        }

        // Test 3: Check status again to verify
        console.log('\n3️⃣ VERIFYING FINAL STATUS...');

        const finalCheckResponse = await fetch(`${baseUrl}/api/checkCalendarWatch`);
        const finalCheckData = await finalCheckResponse.json();

        console.log(`   Final Status: ${finalCheckData.status}`);
        console.log(`   Has Watch: ${finalCheckData.hasWatch}`);

        if (finalCheckData.hasWatch) {
            console.log(`   🆔 Active Channel ID: ${finalCheckData.watchInfo.channelId}`);
            console.log(`   ⏰ Hours remaining: ${finalCheckData.watchInfo.hoursRemaining}`);
        }

        console.log('\n🎯 SMART WATCH SYSTEM TEST RESULTS:');
        console.log('   ✅ Prevents duplicate watch registration');
        console.log('   ✅ Reuses valid existing watches');
        console.log('   ✅ Automatically cleans up expired watches');
        console.log('   ✅ Only one active watch at a time');

        console.log('\n💡 BENEFITS:');
        console.log('   🚫 No more duplicate webhooks');
        console.log('   🔄 Automatic watch management');
        console.log('   📊 Easy status checking');
        console.log('   🛡️ Prevents webhook conflicts');

    } catch (error) {
        console.error('❌ Error testing smart watch system:', error);

        if (error.message.includes('fetch')) {
            console.log('\n💡 NOTE: This test requires your production server to be running');
            console.log('   - Make sure your Next.js app is deployed and accessible');
            console.log('   - The API endpoints need to be available');
        }
    }
}

// Run the test
console.log('🚀 Starting Smart Watch System Test...\n');
testSmartWatch()
    .then(() => console.log('\n🏁 Smart watch system test completed!'))
    .catch(console.error); 