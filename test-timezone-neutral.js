// Test the timezone-neutral date formatting approach

const { format } = require('date-fns');

// Our timezone-neutral date formatting function
const formatDateForDisplay = (dateString) => {
    // Extract date from ISO string to avoid timezone conversion
    const isoDate = new Date(dateString).toISOString();
    const datePart = isoDate.split('T')[0]; // Gets "2025-07-28"
    const [year, month, day] = datePart.split('-');

    // Create a date in the local timezone with these exact values
    const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return format(localDate, "MMM d, yyyy");
};

// Test with Tatiana's date
const tatianaDate = "2025-07-28T00:00:00.000Z";

console.log('🧪 Testing Timezone-Neutral Date Formatting\n');
console.log('📅 Input date:', tatianaDate);
console.log('🎯 Our function result:', formatDateForDisplay(tatianaDate));
console.log('✅ Expected: Jul 28, 2025');
console.log('🌍 Google Calendar shows: Jul 28, 2025, 11:00am - 1:00pm');

console.log('\n🔍 Comparison with timezone-aware functions:');
const date = new Date(tatianaDate);
console.log('🔸 UTC date part:', date.toISOString().split('T')[0]);
console.log('🔸 Eastern Time:', date.toLocaleDateString('en-US', { timeZone: 'America/New_York' }));
console.log('🔸 Pacific Time:', date.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }));
console.log('🔸 India Time:', date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }));

const match = formatDateForDisplay(tatianaDate).includes('28');
console.log('\n' + (match ? '🎉 SUCCESS! Shows July 28th' : '❌ Still showing wrong date')); 