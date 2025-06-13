// Calendar Sync Script - SAFE MIGRATION VERSION
// This script fetches all bookings from both Google Calendar IDs from today onwards
// and ensures they exist in the database to properly block time slots
// 
// MIGRATION SAFETY: Uses timestamps and version tags to protect existing data

const mongoose = require('mongoose');
const { google } = require('googleapis');
const fs = require('fs');
const { formatInTimeZone } = require('date-fns-tz');

// MIGRATION SETTINGS - Change these to control the migration
const MIGRATION_TIMESTAMP = new Date('2024-06-13T00:00:00Z'); // Only affect events after this date
const SYNC_VERSION = 'v2.0-pacific-timezone'; // Version tag for tracking
const SAFE_MODE = true; // Set to false only when you're confident

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

// Booking Schema - ENHANCED with migration tracking
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
  // MIGRATION TRACKING FIELDS
  syncVersion: { type: String, default: null }, // Track which sync version created this
  migrationSafe: { type: Boolean, default: true }, // Mark as safe to modify
  lastSyncUpdate: { type: Date, default: null }, // When was this last updated by sync
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

// Helper: Convert time to 12-hour format - UPDATED for Pacific Time
function convertTimeTo12Hour(date, timeZone = "America/Los_Angeles") {
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

// SAFE Convert calendar event to booking data - ENHANCED with migration safety
function createBookingFromCalendarEvent(event, calendarType = "Manual Booking Calendar", isMigration = false) {
  const timeZone = "America/Los_Angeles"; // UPDATED: Pacific Time for LA client

  // Parse the UTC instants from the event
  const startUtc = new Date(event.start.dateTime || event.start.date);
  const endUtc = new Date(event.end.dateTime || event.end.date);

  // TIMEZONE FIX: Build a timezone-neutral date (no midnight UTC conversion)
  // This prevents the 1-day shift issue for users in different timezones
  const localDateString = formatInTimeZone(startUtc, timeZone, "yyyy-MM-dd");

  // Create a date that represents the booking date without timezone shifts
  // Using the local date but in the user's timezone, not forcing UTC midnight
  const [year, month, day] = localDateString.split("-").map(Number);

  // CRITICAL FIX: Create date in local timezone instead of UTC to prevent shifts
  // This ensures the date displays correctly for all users regardless of their timezone
  const startDate = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid daylight saving issues

  // Format the times for display
  const startTime = convertTimeTo12Hour(startUtc, timeZone);
  const endTime = convertTimeTo12Hour(endUtc, timeZone);

  // Parse studio & customer details
  const studio = parseStudio(event.summary);
  const eventDetails = parseEventDetails(event.description);

  // MIGRATION SAFETY: Determine payment status based on calendar type and migration status
  let paymentStatus;
  if (isMigration && startUtc >= MIGRATION_TIMESTAMP) {
    // NEW LOGIC: Only for events after migration timestamp
    if (calendarType === "Website Booking Calendar") {
      paymentStatus = "success"; // Website bookings are completed payments
    } else {
      paymentStatus = "manual"; // Manual calendar bookings are admin-created
    }
  } else {
    // LEGACY LOGIC: Keep existing behavior for old events
    paymentStatus = "manual"; // Default to manual for safety
  }

  // Build booking object with migration tracking
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
    paymentStatus,
    customerName: eventDetails.customerName,
    customerEmail: eventDetails.customerEmail,
    customerPhone: eventDetails.customerPhone,
    event: eventDetails.event,
    calendarEventId: event.id,
    createdAt: new Date(),
    // MIGRATION TRACKING
    syncVersion: isMigration ? SYNC_VERSION : null,
    migrationSafe: isMigration && startUtc >= MIGRATION_TIMESTAMP,
    lastSyncUpdate: new Date(),
  };
}

// Fetch events from a specific calendar
async function fetchCalendarEvents(calendar, calendarId, calendarName) {
  try {
    console.log(`\n📅 Fetching events from ${calendarName} (${calendarId})...`);

    // Start from June 1st, 2024 instead of today
    const june1st = new Date('2024-06-01T00:00:00.000Z');
    const timeMin = june1st.toISOString();

    // Get events up to 2 years in the future to capture all future bookings
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const timeMax = futureDate.toISOString();

    console.log(`   📅 Fetching events from June 1st, 2024 onwards...`);

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 1000, // Increased to handle more events since we're going back to June
    });

    const events = response.data.items || [];
    console.log(`   Found ${events.length} events since June 1st, 2024`);

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

// SAFE Create booking in database - ENHANCED with migration safety
async function createBookingInDB(bookingData, isUpdate = false) {
  try {
    // Check if booking already exists
    const existingBooking = await Booking.findOne({
      calendarEventId: bookingData.calendarEventId
    });

    if (existingBooking) {
      // MIGRATION SAFETY: Only update if it's safe to do so
      if (SAFE_MODE && !existingBooking.migrationSafe && !isUpdate) {
        console.log(`   🛡️ PROTECTED: Existing booking preserved for event ${bookingData.calendarEventId}`);
        return existingBooking;
      }

      if (isUpdate) {
        // Update existing booking with migration tracking
        const updatedBooking = await Booking.findOneAndUpdate(
          { calendarEventId: bookingData.calendarEventId },
          {
            $set: {
              ...bookingData,
              lastSyncUpdate: new Date()
            }
          },
          { new: true }
        );
        console.log(`   📝 UPDATED booking: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime}-${bookingData.endTime}`);
        return updatedBooking;
      } else {
        console.log(`   ⚠️ Booking already exists for event ${bookingData.calendarEventId}`);
        return existingBooking;
      }
    }

    const booking = new Booking(bookingData);
    await booking.save();
    console.log(`   ✅ Created booking: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime}-${bookingData.endTime}`);
    return booking;

  } catch (error) {
    if (error.code === 11000) { // Duplicate key error
      console.log(`   ⚠️ Duplicate booking skipped for event ${bookingData.calendarEventId}`);
      return null;
    }
    console.error('❌ Error creating booking in DB:', error);
    throw error;
  }
}

// Main sync function - ENHANCED with migration safety
async function syncCalendarWithDatabase() {
  try {
    console.log('📅 CALENDAR SYNC TOOL - SAFE MIGRATION VERSION');
    console.log('===============================================');
    console.log(`🛡️ SAFE MODE: ${SAFE_MODE ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📅 Migration Timestamp: ${MIGRATION_TIMESTAMP.toISOString()}`);
    console.log(`🏷️ Sync Version: ${SYNC_VERSION}`);
    console.log('📅 Fetching ALL events from June 1st, 2024 to present + future');
    console.log('🔄 Will sync from BOTH calendars: Website Booking + Manual Booking');
    console.log('⚠️ NOTE: Will NOT modify or delete anything in Google Calendar');
    console.log('🛡️ NOTE: Existing bookings before migration timestamp are PROTECTED');

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

    // Get calendar IDs from environment - ONLY these two specific calendars
    const calendarIds = [
      { id: env.GOOGLE_CALENDAR_ID, name: 'Manual Booking Calendar' },
      { id: env.GOOGLE_CALENDAR_ID_WEBSITE, name: 'Website Booking Calendar' }
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
    let totalProtectedBookings = 0;

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
            console.log(`   ⏭️ Skipping all-day event: ${event.summary}`);
            continue;
          }

          // Check if booking already exists
          const exists = await bookingExistsInDB(event.id);
          const eventDate = new Date(event.start.dateTime);

          if (exists) {
            const existingBooking = await Booking.findOne({ calendarEventId: event.id });

            // MIGRATION SAFETY: Check if this booking is protected
            if (SAFE_MODE && !existingBooking.migrationSafe && eventDate < MIGRATION_TIMESTAMP) {
              totalProtectedBookings++;
              console.log(`   🛡️ PROTECTED: ${event.summary} (before migration timestamp)`);
              continue;
            }

            totalExistingBookings++;
            console.log(`   ✓ Booking exists: ${event.summary}`);
            continue;
          }

          // Create booking data from calendar event with migration safety
          const bookingData = createBookingFromCalendarEvent(event, calendarConfig.name, true);

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
    console.log('\n📊 SAFE MIGRATION SYNC SUMMARY:');
    console.log('================================');
    console.log(`Total calendar events processed: ${totalEvents}`);
    console.log(`Existing bookings found: ${totalExistingBookings}`);
    console.log(`Protected bookings (unchanged): ${totalProtectedBookings}`);
    console.log(`New bookings created: ${totalNewBookings}`);

    if (totalNewBookings > 0) {
      console.log('\n✅ Calendar sync completed successfully!');
      console.log(`${totalNewBookings} new booking(s) added to database to properly block time slots.`);
    } else {
      console.log('\n✅ Calendar sync completed - all events were already in database.');
    }

    if (totalProtectedBookings > 0) {
      console.log(`\n🛡️ ${totalProtectedBookings} existing bookings were PROTECTED from changes.`);
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
      console.log(`⚠️ Found ${orphanedBookings.length} bookings without calendar events:`);
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
  console.log(`🛡️ SAFE MODE: ${SAFE_MODE ? 'ENABLED' : 'DISABLED'}`);
  console.log(`📅 Migration Timestamp: ${MIGRATION_TIMESTAMP.toISOString()}`);
  console.log('📅 Would fetch ALL events from June 1st, 2024 onwards');
  console.log('🔄 Would sync from BOTH calendars: Website Booking + Manual Booking');

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
      { id: env.GOOGLE_CALENDAR_ID, name: 'Manual Booking Calendar' },
      { id: env.GOOGLE_CALENDAR_ID_WEBSITE, name: 'Website Booking Calendar' }
    ].filter(cal => cal.id);

    console.log(`\n📋 Would sync ${calendarIds.length} calendar(s):`);
    calendarIds.forEach(cal => console.log(`   - ${cal.name}: ${cal.id}`));

    let totalEvents = 0;
    let wouldCreate = 0;
    let wouldProtect = 0;

    for (const calendarConfig of calendarIds) {
      const events = await fetchCalendarEvents(calendar, calendarConfig.id, calendarConfig.name);
      totalEvents += events.length;

      for (const event of events) {
        if (!event.start.dateTime) continue; // Skip all-day events

        const exists = await bookingExistsInDB(event.id);
        const eventDate = new Date(event.start.dateTime);

        if (!exists) {
          wouldCreate++;
          const bookingData = createBookingFromCalendarEvent(event, calendarConfig.name, true);
          console.log(`   📝 Would create: ${bookingData.customerName || 'No name'} - ${bookingData.studio} - ${bookingData.startTime}-${bookingData.endTime} (${bookingData.paymentStatus})`);
        } else if (SAFE_MODE && eventDate < MIGRATION_TIMESTAMP) {
          wouldProtect++;
          console.log(`   🛡️ Would protect: ${event.summary} (before migration timestamp)`);
        }
      }
    }

    console.log(`\n📊 DRY RUN SUMMARY:`);
    console.log(`Total events found: ${totalEvents}`);
    console.log(`Would create: ${wouldCreate} new bookings`);
    console.log(`Would protect: ${wouldProtect} existing bookings`);
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