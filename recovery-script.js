// MongoDB Data Recovery Script
// This script helps analyze what bookings might have been deleted

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
          
          // Handle multi-line values (check if next line continues the value)
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

// Booking Schema (same as in your app)
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

async function analyzeBookings() {
  try {
    if (!env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in .env file');
      return;
    }
    
    await mongoose.connect(env.MONGODB_URI);
    console.log('📊 Connected to MongoDB');
    
    // Get all current bookings
    const allBookings = await Booking.find({});
    console.log(`\n📋 Current bookings in database: ${allBookings.length}`);
    
    if (allBookings.length === 0) {
      console.log('⚠️  No bookings found in database!');
      console.log('   This could mean:');
      console.log('   1. All bookings were accidentally deleted');
      console.log('   2. Connected to wrong database');
      console.log('   3. Database is empty (new setup)');
      return;
    }
    
    // Analyze by payment status
    const statusCounts = await Booking.aggregate([
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📊 Bookings by Status:');
    statusCounts.forEach(status => {
      console.log(`  ${status._id || 'null'}: ${status.count} bookings`);
    });
    
    // Find recent bookings (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentBookings = await Booking.find({
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: -1 });
    
    console.log(`\n📅 Recent bookings (last 7 days): ${recentBookings.length}`);
    
    // Show recent bookings details
    if (recentBookings.length > 0) {
      console.log('\n🔍 Recent Booking Details:');
      recentBookings.slice(0, 10).forEach((booking, index) => {
        console.log(`${index + 1}. ${booking.customerName || 'No name'} - ${booking.studio} - ${booking.paymentStatus} - ${booking.createdAt.toISOString()}`);
      });
      if (recentBookings.length > 10) {
        console.log(`   ... and ${recentBookings.length - 10} more`);
      }
    }
    
    // Check for potential issues
    console.log('\n🔍 Checking for potential issues:');
    
    // Find bookings without calendar events
    const noCalendarEvents = await Booking.find({
      paymentStatus: 'success',
      $or: [
        { calendarEventId: { $exists: false } },
        { calendarEventId: null },
        { calendarEventId: '' }
      ]
    });
    console.log(`  Successful bookings without calendar events: ${noCalendarEvents.length}`);
    
    // Check what happened in the last hour (potential deletions)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const veryRecentBookings = await Booking.find({
      createdAt: { $gte: oneHourAgo }
    });
    console.log(`  Bookings created in last hour: ${veryRecentBookings.length}`);
    
    // Check for old pending bookings (these might have been cleaned up)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const oldPendingBookings = await Booking.find({
      paymentStatus: 'pending',
      createdAt: { $lt: thirtyMinutesAgo }
    });
    console.log(`  Old pending bookings (>30 min): ${oldPendingBookings.length}`);
    
    console.log('\n✅ Analysis complete!');
    console.log('\n💡 Next steps:');
    console.log('  1. Check your dashboard at /Dashboard to see current bookings');
    console.log('  2. If important bookings are missing, check MongoDB Atlas/Cloud backups');
    console.log('  3. Contact your MongoDB provider for point-in-time recovery if needed');
    
  } catch (error) {
    console.error('❌ Error analyzing bookings:', error);
  } finally {
    await mongoose.disconnect();
  }
}

function convertToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [time, period] = timeStr.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes;
  if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60;
  if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60;
  return totalMinutes;
}

// Recovery functions
async function restoreFromBackup() {
  console.log('🔄 Looking for backup data...');
  // This would connect to backup sources if available
  // For now, we'll just check what we have
}

async function fixMissingCalendarEvents() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const bookingsWithoutEvents = await Booking.find({
      paymentStatus: 'success',
      calendarEventId: { $exists: false }
    });
    
    console.log(`🔧 Found ${bookingsWithoutEvents.length} successful bookings without calendar events`);
    
    // You could add calendar event creation logic here
    
  } catch (error) {
    console.error('❌ Error fixing calendar events:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run analysis
console.log('🚀 Starting MongoDB Data Recovery Analysis...');
console.log('🔍 This will show you what bookings are currently in your database\n');
analyzeBookings(); 