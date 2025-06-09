// Fix Studio Names Script
// This script fixes existing bookings that were created with incorrect studio names

const mongoose = require('mongoose');
const { google } = require('googleapis');
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
          
          // Handle multi-line values
          while (i + 1 < lines.length && !lines[i + 1].includes('=') && !lines[i + 1].startsWith('#')) {
            i++;
            value += lines[i].trim();
          }
          
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
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

// Initialize Google Calendar API
async function initializeGoogleCalendar() {
  try {
    let serviceAccountKey = env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY not found in environment variables');
      return null;
    }

    const serviceAccount = JSON.parse(serviceAccountKey);
    
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    return google.calendar('v3');
  } catch (error) {
    console.error('❌ Failed to initialize Google Calendar API:', error);
    return null;
  }
}

// Fixed studio parsing function
function parseStudioCorrectly(summary) {
  if (!summary) return 'Studio A'; // default
  
  // Convert to lowercase for easier matching
  const lowerSummary = summary.toLowerCase();
  
  // Look for "Booking for [STUDIO NAME]" pattern
  const bookingForMatch = summary.match(/booking for (.+?)(?:\s*-|$)/i);
  if (bookingForMatch) {
    const studioName = bookingForMatch[1].trim();
    
    // Map your specific studio names
    const studioLower = studioName.toLowerCase();
    if (studioLower.includes('ground')) return 'THE GROUND';
    if (studioLower.includes('extension')) return 'THE EXTENSION';
    if (studioLower.includes('lab')) return 'THE LAB';
    
    // Return the extracted name as-is if it doesn't match known studios
    return studioName.toUpperCase();
  }
  
  // Look for direct studio name mentions
  if (lowerSummary.includes('the ground')) return 'THE GROUND';
  if (lowerSummary.includes('the extension')) return 'THE EXTENSION';
  if (lowerSummary.includes('the lab')) return 'THE LAB';
  
  // Legacy support for Studio A/B/C format
  const studioMatch = summary.match(/Studio ([A-Z])/i);
  if (studioMatch) {
    return `Studio ${studioMatch[1].toUpperCase()}`;
  }
  
  // Look for studio keywords
  if (lowerSummary.includes('studio b')) return 'Studio B';
  if (lowerSummary.includes('studio c')) return 'Studio C';
  if (lowerSummary.includes('studio a')) return 'Studio A';
  
  return 'Studio A'; // default fallback
}

// Get calendar event by ID
async function getCalendarEvent(calendar, calendarId, eventId) {
  try {
    const response = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching event ${eventId}:`, error.message);
    return null;
  }
}

// Main fix function
async function fixStudioNames() {
  try {
    console.log('🔧 STUDIO NAME FIX TOOL');
    console.log('========================');
    
    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Initialize Google Calendar
    const calendar = await initializeGoogleCalendar();
    if (!calendar) {
      console.error('❌ Failed to initialize Google Calendar API');
      return;
    }
    
    console.log('✅ Connected to Google Calendar API');
    
    // Get calendar IDs from environment
    const calendarIds = [
      env.GOOGLE_CALENDAR_ID,
      env.GOOGLE_CALENDAR_ID_WEBSITE
    ].filter(id => id);
    
    // Find all bookings with calendar event IDs that might have wrong studio names
    const bookingsToCheck = await Booking.find({
      calendarEventId: { $exists: true, $ne: null },
      studio: 'Studio A' // Focus on bookings that defaulted to Studio A
    });
    
    console.log(`\n🔍 Found ${bookingsToCheck.length} bookings with 'Studio A' that need checking...`);
    
    let fixedCount = 0;
    let checkedCount = 0;
    
    for (const booking of bookingsToCheck) {
      checkedCount++;
      console.log(`\n${checkedCount}/${bookingsToCheck.length} Checking booking: ${booking.customerName || 'No name'} - ${booking.calendarEventId}`);
      
      let calendarEvent = null;
      
      // Try to find the event in both calendars
      for (const calendarId of calendarIds) {
        calendarEvent = await getCalendarEvent(calendar, calendarId, booking.calendarEventId);
        if (calendarEvent) {
          console.log(`   📅 Found event in calendar: "${calendarEvent.summary}"`);
          break;
        }
      }
      
      if (!calendarEvent) {
        console.log(`   ⚠️  Calendar event not found for booking ${booking.calendarEventId}`);
        continue;
      }
      
      // Parse the correct studio name
      const correctStudio = parseStudioCorrectly(calendarEvent.summary);
      
      if (correctStudio !== booking.studio) {
        console.log(`   🔧 Fixing studio: "${booking.studio}" → "${correctStudio}"`);
        
        // Update the booking
        await Booking.findByIdAndUpdate(booking._id, {
          studio: correctStudio
        });
        
        fixedCount++;
      } else {
        console.log(`   ✓ Studio name is already correct: "${correctStudio}"`);
      }
    }
    
    console.log('\n📊 FIX SUMMARY:');
    console.log('===============');
    console.log(`Bookings checked: ${checkedCount}`);
    console.log(`Studio names fixed: ${fixedCount}`);
    
    if (fixedCount > 0) {
      console.log('\n✅ Studio name fix completed successfully!');
      console.log(`${fixedCount} booking(s) now have correct studio names.`);
    } else {
      console.log('\n✅ All studio names were already correct.');
    }
    
  } catch (error) {
    console.error('❌ Studio name fix failed:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n📤 Disconnected from MongoDB');
    }
  }
}

// Dry run mode
async function dryRunFix() {
  console.log('🔍 DRY RUN MODE - No changes will be made');
  console.log('=========================================');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ Connected to MongoDB (read-only)');
    
    // Initialize Google Calendar
    const calendar = await initializeGoogleCalendar();
    if (!calendar) {
      console.error('❌ Failed to initialize Google Calendar API');
      return;
    }
    
    console.log('✅ Connected to Google Calendar API');
    
    // Get calendar IDs
    const calendarIds = [
      env.GOOGLE_CALENDAR_ID,
      env.GOOGLE_CALENDAR_ID_WEBSITE
    ].filter(id => id);
    
    // Find bookings to check
    const bookingsToCheck = await Booking.find({
      calendarEventId: { $exists: true, $ne: null },
      studio: 'Studio A'
    });
    
    console.log(`\n🔍 Would check ${bookingsToCheck.length} bookings with 'Studio A'...`);
    
    let wouldFix = 0;
    
    for (const booking of bookingsToCheck) {
      let calendarEvent = null;
      
      // Try to find the event in both calendars
      for (const calendarId of calendarIds) {
        calendarEvent = await getCalendarEvent(calendar, calendarId, booking.calendarEventId);
        if (calendarEvent) break;
      }
      
      if (calendarEvent) {
        const correctStudio = parseStudioCorrectly(calendarEvent.summary);
        if (correctStudio !== booking.studio) {
          console.log(`   📝 Would fix: "${booking.customerName || 'No name'}" - "${booking.studio}" → "${correctStudio}"`);
          wouldFix++;
        }
      }
    }
    
    console.log(`\n📊 DRY RUN SUMMARY:`);
    console.log(`Bookings to check: ${bookingsToCheck.length}`);
    console.log(`Would fix: ${wouldFix} studio names`);
    console.log(`\nTo execute the fix, run: node fix-studio-names.js --execute`);
    
  } catch (error) {
    console.error('❌ Dry run failed:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--execute') || args.includes('-e')) {
    await fixStudioNames();
  } else {
    await dryRunFix();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
} 