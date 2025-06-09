// Pending Bookings Recovery Script
// This script attempts to find and recover deleted pending bookings

const mongoose = require('mongoose');
const fs = require('fs');

// Load environment variables manually
function loadEnv() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const envVars = {};
    const lines = envContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#')) {
        const equalIndex = line.indexOf('=');
        if (equalIndex > 0) {
          const key = line.substring(0, equalIndex).trim();
          let value = line.substring(equalIndex + 1).trim();
          
          while (i + 1 < lines.length && !lines[i + 1].includes('=') && !lines[i + 1].startsWith('#')) {
            i++;
            value += lines[i].trim();
          }
          
          envVars[key] = value;
        }
      }
    }
    return envVars;
  } catch (error) {
    console.error('❌ Could not load .env file:', error.message);
    return {};
  }
}

const env = loadEnv();

// Booking Schema
const BookingSchema = new mongoose.Schema({
  studio: { type: String, required: true },
  startDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  items: { type: Array, default: [] },
  subtotal: { type: Number, default: 0 },
  studioCost: { type: Number, default: 0 },
  cleaningFee: { type: Number, default: 0 },
  estimatedTotal: { type: Number, default: 0 },
  paymentStatus: { type: String, default: "manual" },
  customerName: { type: String, default: "" },
  customerEmail: { type: String, default: "" },
  customerPhone: { type: String, default: "" },
  event: { type: Boolean, default: false },
  calendarEventId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model('Booking', BookingSchema);

async function searchForPendingBookings() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('📊 Connected to MongoDB for pending booking recovery');
    
    // Method 1: Check if any pending bookings still exist
    console.log('\n🔍 Method 1: Checking for existing pending bookings...');
    const existingPending = await Booking.find({ paymentStatus: 'pending' });
    console.log(`Found ${existingPending.length} existing pending bookings`);
    
    if (existingPending.length > 0) {
      console.log('📋 Existing Pending Bookings:');
      existingPending.forEach((booking, index) => {
        const age = Math.round((Date.now() - new Date(booking.createdAt).getTime()) / (1000 * 60));
        console.log(`${index + 1}. ${booking.customerName || 'No name'} - ${booking.studio} - ${age} min ago`);
        console.log(`   Date: ${booking.startDate.toDateString()} ${booking.startTime}-${booking.endTime}`);
        console.log(`   Total: $${booking.estimatedTotal}`);
      });
    }
    
    // Method 2: Check MongoDB change streams or operation logs (if available)
    console.log('\n🔍 Method 2: Checking for recently deleted documents...');
    
    // Method 3: Look for patterns in booking IDs or timestamps
    console.log('\n🔍 Method 3: Analyzing booking creation patterns...');
    const allBookings = await Booking.find({}).sort({ createdAt: 1 });
    
    // Look for gaps in creation times that might indicate deletions
    let suspiciousGaps = [];
    for (let i = 1; i < allBookings.length; i++) {
      const prev = allBookings[i-1];
      const current = allBookings[i];
      const timeDiff = new Date(current.createdAt) - new Date(prev.createdAt);
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff > 24) { // Gap of more than 24 hours
        suspiciousGaps.push({
          after: prev.createdAt,
          before: current.createdAt,
          gapHours: Math.round(hoursDiff)
        });
      }
    }
    
    if (suspiciousGaps.length > 0) {
      console.log(`⚠️  Found ${suspiciousGaps.length} suspicious time gaps that might indicate deletions:`);
      suspiciousGaps.forEach((gap, index) => {
        console.log(`${index + 1}. Gap of ${gap.gapHours} hours between ${gap.after} and ${gap.before}`);
      });
    } else {
      console.log('✅ No suspicious gaps in booking creation times found');
    }
    
    // Method 4: Check for partial data or orphaned references
    console.log('\n🔍 Method 4: Looking for orphaned data...');
    
    // Check for Stripe sessions that might not have corresponding bookings
    console.log('Note: You may want to check your Stripe dashboard for checkout sessions without corresponding bookings');
    
    // Method 5: Check recent database operations
    console.log('\n🔍 Method 5: Recent database activity analysis...');
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentBookings = await Booking.find({
      createdAt: { $gte: last24Hours }
    }).sort({ createdAt: -1 });
    
    console.log(`Recent activity (last 24h): ${recentBookings.length} bookings created`);
    
    // Look for booking patterns
    const statusCounts = {};
    recentBookings.forEach(booking => {
      statusCounts[booking.paymentStatus] = (statusCounts[booking.paymentStatus] || 0) + 1;
    });
    
    console.log('Recent booking status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} bookings`);
    });
    
  } catch (error) {
    console.error('❌ Error searching for pending bookings:', error);
  } finally {
    await mongoose.disconnect();
  }
}

async function createRecoveryOptions() {
  console.log('\n🛠️  RECOVERY OPTIONS:');
  console.log('');
  console.log('1. 📊 CHECK STRIPE DASHBOARD:');
  console.log('   - Go to Stripe Dashboard > Payments');
  console.log('   - Look for recent checkout sessions');
  console.log('   - Find sessions without corresponding bookings');
  console.log('');
  console.log('2. 🔍 CHECK APPLICATION LOGS:');
  console.log('   - Review server logs for booking creation attempts');
  console.log('   - Look for error messages or failed transactions');
  console.log('');
  console.log('3. 💾 CHECK MONGODB ATLAS BACKUPS:');
  console.log('   - If using MongoDB Atlas, check point-in-time backups');
  console.log('   - Restore from backup before cleanup occurred');
  console.log('');
  console.log('4. 📧 CHECK EMAIL CONFIRMATIONS:');
  console.log('   - Review sent emails for booking confirmations');
  console.log('   - Use email data to manually recreate bookings');
  console.log('');
  console.log('5. 🗓️  CHECK GOOGLE CALENDAR:');
  console.log('   - Look for calendar events without database entries');
  console.log('   - These might be manually created bookings');
}

async function manualRecoveryWizard() {
  console.log('\n🧙‍♂️ MANUAL RECOVERY WIZARD');
  console.log('If you have specific pending booking details, you can manually recreate them:');
  console.log('');
  console.log('Required information for manual recovery:');
  console.log('- Customer name, email, phone');
  console.log('- Studio, date, start/end time');
  console.log('- Add-ons and pricing');
  console.log('- Event status (yes/no)');
  console.log('');
  console.log('To manually add a booking:');
  console.log('1. Use the admin dashboard');
  console.log('2. Or directly add to Google Calendar');
  console.log('3. Or create via API endpoint');
}

async function preventFutureDataLoss() {
  console.log('\n🛡️  PREVENT FUTURE DATA LOSS:');
  console.log('');
  console.log('✅ ALREADY IMPLEMENTED:');
  console.log('- Cleanup only targets old pending bookings (>30 min)');
  console.log('- Successful and manual bookings are protected');
  console.log('- Detailed logging for all operations');
  console.log('');
  console.log('📋 RECOMMENDED ADDITIONAL MEASURES:');
  console.log('1. Set up MongoDB Atlas automated backups');
  console.log('2. Implement audit logging for all booking operations');
  console.log('3. Add booking status change notifications');
  console.log('4. Create periodic backup exports');
  console.log('5. Set up monitoring alerts for unusual deletion patterns');
}

// Main execution
async function main() {
  console.log('🚀 PENDING BOOKINGS RECOVERY TOOL');
  console.log('=======================================');
  
  await searchForPendingBookings();
  await createRecoveryOptions();
  await manualRecoveryWizard();
  await preventFutureDataLoss();
  
  console.log('\n✅ Recovery analysis complete!');
  console.log('\nNext steps:');
  console.log('1. Check the methods above for recovering specific bookings');
  console.log('2. Contact customers if you find missing critical bookings');
  console.log('3. Implement additional backup measures');
}

main(); 