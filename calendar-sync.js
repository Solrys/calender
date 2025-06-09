// Calendar Sync Script
// This script fetches all bookings from both Google Calendar IDs from today onwards
// and ensures they exist in the database to properly block time slots

const mongoose = require('mongoose');
const { google } = require('googleapis');
const fs = require('fs');
const { formatInTimeZone } = require('date-fns-tz');

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

// Helper: Convert time to 12-hour format
function convertTimeTo12Hour(date, timeZone = "America/New_York") {
  return formatInTimeZone(date, timeZone, "h:mm a");
}

// Helper: Parse studio from event summary
function parseStudio(summary) {
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

// Helper: Parse event details from description
function parseEventDetails(description) {
  const details = {
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    event: false,
    subtotal: 0,
    studioCost: 0,
    estimatedTotal: 0,
    cleaningFee: 0,
    items: []
  };

  if (!description) return details;

  const lines = description.split('\n');
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    
    if (line.startsWith('Customer Name:')) {
      details.customerName = line.split(':')[1]?.trim() || '';
    } else if (line.startsWith('Customer Email:')) {
      details.customerEmail = line.split(':')[1]?.trim() || '';
    } else if (line.startsWith('Customer Phone:')) {
      details.customerPhone = line.split(':')[1]?.trim() || '';
    } else if (lowerLine.includes('event: yes')) {
      details.event = true;
    } else if (line.startsWith('Subtotal: $')) {
      details.subtotal = parseFloat(line.replace('Subtotal: $', '')) || 0;
    } else if (line.startsWith('Studio Cost: $')) {
      details.studioCost = parseFloat(line.replace('Studio Cost: $', '')) || 0;
    } else if (line.startsWith('Estimated Total: $')) {
      details.estimatedTotal = parseFloat(line.replace('Estimated Total: $', '')) || 0;
    }
  }

  return details;
}

// Convert calendar event to booking data
function createBookingFromCalendarEvent(event) {
  const timeZone = "America/New_York";

  // Parse the UTC instants from the event
  const startUtc = new Date(event.start.dateTime || event.start.date);
  const endUtc = new Date(event.end.dateTime || event.end.date);

  // Build the local date string in ET
  const localDateString = formatInTimeZone(startUtc, timeZone, "yyyy-MM-dd");
  
  // Convert that local date at midnight back into a UTC Date
  const [year, month, day] = localDateString.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  // Format the times for display
  const startTime = convertTimeTo12Hour(startUtc, timeZone);
  const endTime = convertTimeTo12Hour(endUtc, timeZone);

  // Parse studio & customer details
  const studio = parseStudio(event.summary);
  const eventDetails = parseEventDetails(event.description);

  // Build booking object
  return {
    studio,
    startDate,
    startTime,
    endTime,
    items: eventDetails.items,
    subtotal: eventDetails.subtotal,
    studioCost: eventDetails.studioCost,
    cleaningFee: eventDetails.cleaningFee,
    estimatedTotal: eventDetails.estimatedTotal,
    paymentStatus: "manual", // Calendar events are considered manual bookings
    customerName: eventDetails.customerName,
    customerEmail: eventDetails.customerEmail,
    customerPhone: eventDetails.customerPhone,
    event: eventDetails.event,
    calendarEventId: event.id,
    createdAt: new Date(),
  };
}

// Fetch events from a specific calendar
async function fetchCalendarEvents(calendar, calendarId, calendarName) {
  try {
    console.log(`\n📅 Fetching events from ${calendarName} (${calendarId})...`);
    
    const now = new Date();
    const timeMin = now.toISOString();
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1); // Get events for next year
    const timeMax = futureDate.toISOString();

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500, // Adjust as needed
    });

    const events = response.data.items || [];
    console.log(`   Found ${events.length} future events`);
    
    return events.map(event => ({
      ...event,
      calendarSource: calendarName
    }));
    
  } catch (error) {
    console.error(`❌ Error fetching events from ${calendarName}:`, error.message);
    return [];
  }
}

// Check if booking exists in database
async function bookingExistsInDB(calendarEventId) {
  try {
    const booking = await Booking.findOne({ calendarEventId });
    return booking !== null;
  } catch (error) {
    console.error('❌ Error checking booking in DB:', error);
    return false;
  }
}

// Create booking in database
async function createBookingInDB(bookingData) {
  try {
    // Check if booking already exists
    const existingBooking = await Booking.findOne({ 
      calendarEventId: bookingData.calendarEventId 
    });
    
    if (existingBooking) {
      console.log(`   ⚠️  Booking already exists for event ${bookingData.calendarEventId}`);
      return existingBooking;
    }

    const booking = new Booking(bookingData);
    await booking.save();
    console.log(`   ✅ Created booking: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime}-${bookingData.endTime}`);
    return booking;
    
  } catch (error) {
    if (error.code === 11000) { // Duplicate key error
      console.log(`   ⚠️  Duplicate booking skipped for event ${bookingData.calendarEventId}`);
      return null;
    }
    console.error('❌ Error creating booking in DB:', error);
    throw error;
  }
}

// Main sync function
async function syncCalendarWithDatabase() {
  try {
    console.log('🚀 CALENDAR SYNC TOOL');
    console.log('=====================');
    
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
      { id: env.GOOGLE_CALENDAR_ID, name: 'Main Calendar' },
      { id: env.GOOGLE_CALENDAR_ID_WEBSITE, name: 'Website Calendar' }
    ].filter(cal => cal.id); // Remove any undefined calendar IDs
    
    if (calendarIds.length === 0) {
      console.error('❌ No calendar IDs found in environment variables');
      console.error('   Please set GOOGLE_CALENDAR_ID and/or GOOGLE_CALENDAR_ID_WEBSITE');
      return;
    }
    
    console.log(`\n📋 Found ${calendarIds.length} calendar(s) to sync:`);
    calendarIds.forEach(cal => console.log(`   - ${cal.name}: ${cal.id}`));
    
    let totalEvents = 0;
    let totalNewBookings = 0;
    let totalExistingBookings = 0;
    
    // Fetch and process events from each calendar
    for (const calendarConfig of calendarIds) {
      const events = await fetchCalendarEvents(calendar, calendarConfig.id, calendarConfig.name);
      
      if (events.length === 0) {
        console.log(`   No events found in ${calendarConfig.name}`);
        continue;
      }
      
      totalEvents += events.length;
      
      console.log(`\n🔄 Processing ${events.length} events from ${calendarConfig.name}...`);
      
      for (const event of events) {
        try {
          // Skip all-day events
          if (!event.start.dateTime) {
            console.log(`   ⏭️  Skipping all-day event: ${event.summary}`);
            continue;
          }
          
          // Check if booking already exists
          const exists = await bookingExistsInDB(event.id);
          
          if (exists) {
            totalExistingBookings++;
            console.log(`   ✓ Booking exists: ${event.summary}`);
            continue;
          }
          
          // Create booking data from calendar event
          const bookingData = createBookingFromCalendarEvent(event);
          
          // Create booking in database
          const newBooking = await createBookingInDB(bookingData);
          if (newBooking) {
            totalNewBookings++;
          }
          
        } catch (error) {
          console.error(`   ❌ Error processing event ${event.id}:`, error.message);
        }
      }
    }
    
    // Summary
    console.log('\n📊 SYNC SUMMARY:');
    console.log('================');
    console.log(`Total calendar events processed: ${totalEvents}`);
    console.log(`Existing bookings found: ${totalExistingBookings}`);
    console.log(`New bookings created: ${totalNewBookings}`);
    
    if (totalNewBookings > 0) {
      console.log('\n✅ Calendar sync completed successfully!');
      console.log(`${totalNewBookings} new booking(s) added to database to properly block time slots.`);
    } else {
      console.log('\n✅ Calendar sync completed - all events were already in database.');
    }
    
    // Verification: Check for any bookings without calendar events
    console.log('\n🔍 Checking for orphaned database bookings...');
    const orphanedBookings = await Booking.find({
      $or: [
        { calendarEventId: { $exists: false } },
        { calendarEventId: null },
        { calendarEventId: '' }
      ],
      paymentStatus: { $in: ['success', 'manual'] }
    });
    
    if (orphanedBookings.length > 0) {
      console.log(`⚠️  Found ${orphanedBookings.length} bookings without calendar events:`);
      orphanedBookings.forEach(booking => {
        console.log(`   - ${booking.customerName || 'No name'} - ${booking.studio} - ${booking.startDate.toDateString()} ${booking.startTime}`);
      });
      console.log('   Consider creating calendar events for these bookings.');
    } else {
      console.log('✅ No orphaned bookings found.');
    }
    
  } catch (error) {
    console.error('❌ Calendar sync failed:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n📤 Disconnected from MongoDB');
    }
  }
}

// Dry run mode - just show what would be synced without making changes
async function dryRun() {
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
      { id: env.GOOGLE_CALENDAR_ID, name: 'Main Calendar' },
      { id: env.GOOGLE_CALENDAR_ID_WEBSITE, name: 'Website Calendar' }
    ].filter(cal => cal.id);
    
    console.log(`\n📋 Would sync ${calendarIds.length} calendar(s):`);
    calendarIds.forEach(cal => console.log(`   - ${cal.name}: ${cal.id}`));
    
    let totalEvents = 0;
    let wouldCreate = 0;
    
    for (const calendarConfig of calendarIds) {
      const events = await fetchCalendarEvents(calendar, calendarConfig.id, calendarConfig.name);
      totalEvents += events.length;
      
      for (const event of events) {
        if (!event.start.dateTime) continue; // Skip all-day events
        
        const exists = await bookingExistsInDB(event.id);
        if (!exists) {
          wouldCreate++;
          const bookingData = createBookingFromCalendarEvent(event);
          console.log(`   📝 Would create: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime}-${bookingData.endTime}`);
        }
      }
    }
    
    console.log(`\n📊 DRY RUN SUMMARY:`);
    console.log(`Total events found: ${totalEvents}`);
    console.log(`Would create: ${wouldCreate} new bookings`);
    console.log(`\nTo execute the sync, run: node calendar-sync.js --execute`);
    
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
    await syncCalendarWithDatabase();
  } else {
    await dryRun();
  }
}

// Export functions for testing
module.exports = {
  syncCalendarWithDatabase,
  dryRun,
  createBookingFromCalendarEvent,
  fetchCalendarEvents
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
} 