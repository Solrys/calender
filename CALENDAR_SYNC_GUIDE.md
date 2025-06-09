# Calendar Sync Tool Guide

## 🎯 Purpose

This script syncs your Google Calendar events with your database to ensure all bookings properly block time slots on your website. It's designed to solve the issue where calendar events exist but don't prevent double bookings.

## 🔧 What It Does

1. **Fetches all future events** from both your calendar IDs (today onwards)
2. **Parses event details** (customer info, studio, times, pricing)
3. **Creates missing database entries** to properly block time slots
4. **Prevents double bookings** by ensuring calendar events exist in the database
5. **Handles both calendar IDs** (GOOGLE_CALENDAR_ID and GOOGLE_CALENDAR_ID_WEBSITE)

## 📋 Requirements

### Required Dependencies
```bash
npm install googleapis date-fns-tz mongoose
```

### Environment Variables Required
Your `.env` file must contain:
```bash
MONGODB_URI=mongodb+srv://your-connection-string
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_CALENDAR_ID=your-main-calendar-id
GOOGLE_CALENDAR_ID_WEBSITE=your-website-calendar-id
```

## 🚀 How to Use

### 1. Dry Run (Recommended First Step)
**Preview what would be synced without making any changes:**
```bash
node calendar-sync.js
```

This will show you:
- How many calendar events were found
- Which events would create new database bookings
- A summary of what would happen

### 2. Execute the Sync
**Actually sync the calendar events to database:**
```bash
node calendar-sync.js --execute
```
or
```bash
node calendar-sync.js -e
```

This will:
- Create database bookings for missing calendar events
- Show detailed progress and results
- Report a final summary

## 📊 What You'll See

### Dry Run Output Example:
```
🔍 DRY RUN MODE - No changes will be made
=========================================
✅ Connected to MongoDB (read-only)
✅ Connected to Google Calendar API

📋 Would sync 2 calendar(s):
   - Main Calendar: your-calendar-id-1
   - Website Calendar: your-calendar-id-2

📅 Fetching events from Main Calendar...
   Found 5 future events

📝 Would create: John Doe - Studio A - 10:00 AM-12:00 PM
📝 Would create: Jane Smith - Studio B - 2:00 PM-4:00 PM

📊 DRY RUN SUMMARY:
Total events found: 5
Would create: 2 new bookings

To execute the sync, run: node calendar-sync.js --execute
```

### Execution Output Example:
```
🚀 CALENDAR SYNC TOOL
=====================
✅ Connected to MongoDB
✅ Connected to Google Calendar API

📋 Found 2 calendar(s) to sync:
   - Main Calendar: your-calendar-id-1
   - Website Calendar: your-calendar-id-2

🔄 Processing 5 events from Main Calendar...
   ✓ Booking exists: Existing Customer - Studio A
   ✅ Created booking: John Doe - Studio A - 10:00 AM-12:00 PM
   ✅ Created booking: Jane Smith - Studio B - 2:00 PM-4:00 PM

📊 SYNC SUMMARY:
================
Total calendar events processed: 5
Existing bookings found: 3
New bookings created: 2

✅ Calendar sync completed successfully!
2 new booking(s) added to database to properly block time slots.
```

## 🔍 Event Processing Rules

### Events That Will Be Synced:
- ✅ **Future events** (today onwards)
- ✅ **Timed events** (not all-day events)
- ✅ **Events with start/end times**
- ✅ **Events from both calendar IDs**

### Events That Will Be Skipped:
- ❌ **Past events** (before today)
- ❌ **All-day events** (no specific times)
- ❌ **Events already in database** (no duplicates)

### Event Parsing:
The script intelligently parses:
- **Studio**: From event title (e.g., "Booking for Studio A")
- **Customer Info**: From event description (name, email, phone)
- **Event Status**: Whether it's an event booking (cleaning fee)
- **Pricing**: Subtotal, studio cost, estimated total
- **Times**: Properly converts to 12-hour format in Eastern Time

## 🛡️ Safety Features

### Duplicate Prevention:
- Checks existing `calendarEventId` in database
- Won't create duplicate bookings for same calendar event
- Gracefully handles MongoDB unique key constraints

### Data Validation:
- Validates calendar event structure
- Handles missing or malformed event data
- Provides detailed error logging for troubleshooting

### Booking Status:
- All calendar-synced bookings get `paymentStatus: "manual"`
- This ensures they block time slots (not "pending")
- Won't interfere with existing successful online bookings

## 🔧 Troubleshooting

### Common Issues:

**1. "GOOGLE_SERVICE_ACCOUNT_KEY not found"**
```
Solution: Check your .env file has the Google service account JSON
```

**2. "No calendar IDs found"**
```
Solution: Set GOOGLE_CALENDAR_ID and GOOGLE_CALENDAR_ID_WEBSITE in .env
```

**3. "Error fetching events from calendar"**
```
Solution: Verify calendar ID is correct and service account has access
```

**4. MongoDB connection errors**
```
Solution: Check MONGODB_URI is correct and database is accessible
```

### Debug Mode:
The script provides detailed logging for each step. Look for:
- ✅ Success messages
- ⚠️ Warning messages (non-critical)
- ❌ Error messages (need attention)

## 📅 When to Use This Script

### Ideal Scenarios:
1. **After manual calendar changes** - You added/edited events directly in Google Calendar
2. **Initial setup** - Sync existing calendar events to new database
3. **Regular maintenance** - Ensure calendar and database stay in sync
4. **After system issues** - Recover from booking/calendar sync problems
5. **Before busy periods** - Ensure all time slots are properly blocked

### Automation Options:
You could run this script:
- **Weekly** via cron job for regular maintenance
- **Before peak booking times** to ensure accuracy
- **After bulk calendar changes** to sync updates
- **As needed** when you notice sync issues

## 🔄 Integration with Your System

### How It Helps Your Booking System:
1. **Prevents Double Bookings**: Calendar events now block time slots
2. **Maintains Data Consistency**: Calendar and database stay synchronized
3. **Preserves Manual Bookings**: Admin calendar entries are recognized
4. **Supports Both Calendar IDs**: Works with your dual-calendar setup

### Safe to Run:
- **Won't delete existing data** - Only creates missing bookings
- **Won't modify existing bookings** - Skips duplicates
- **Won't affect successful payments** - Only handles manual calendar events
- **Respects existing system** - Works alongside current booking flow

## 📈 Results and Verification

After running the sync:

1. **Check your booking dashboard** - New manual bookings should appear
2. **Test time slot blocking** - Previously unblocked times should now be blocked
3. **Verify calendar events** - All should have corresponding database entries
4. **Monitor for conflicts** - Double bookings should be prevented

The script also provides a verification report showing any orphaned bookings (database entries without calendar events).

## 💡 Pro Tips

1. **Always run dry run first** to preview changes
2. **Run during low-traffic times** to avoid conflicts
3. **Keep backups** of your database before major syncs
4. **Monitor results** after running to ensure everything looks correct
5. **Document any manual calendar changes** for reference

## 🆘 Support

If you encounter issues:
1. Check the detailed console output for specific error messages
2. Verify all environment variables are correctly set
3. Ensure Google service account has calendar access
4. Test with a small number of events first
5. Contact support with specific error messages and context 