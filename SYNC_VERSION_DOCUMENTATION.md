# Sync Version System Documentation

## 📋 **What is Sync Version?**

The `syncVersion` is a field in your booking database that tracks which version of the calendar synchronization logic was used when a booking was created. It's essentially a "fingerprint" that tells us how to properly handle date formatting and display for each booking.

## 🎯 **Why Do We Need Sync Versions?**

### **The Core Problem**

Your booking system has evolved over time, and different bookings were created with different date handling logic:

1. **Old bookings**: Created with timezone issues that required +1 day correction
2. **Newer bookings**: Created with improved logic that doesn't need correction
3. **Calendar-synced bookings**: Created directly from Google Calendar events

Without sync versions, we can't tell which bookings need date correction and which don't, leading to:

- ❌ Dates showing incorrectly in dashboard (June 25th showing as June 26th)
- ❌ Time slots being blocked on wrong dates
- ❌ Double booking risks

## 🔧 **Current Sync Versions in Your System**

| Sync Version                    | Description                | Date Correction Needed | Usage                    |
| ------------------------------- | -------------------------- | ---------------------- | ------------------------ |
| `null` or `undefined`           | Very old bookings          | ✅ YES (+1 day)        | Legacy bookings          |
| `v2.5-date-timezone-fixed`      | First timezone fix attempt | ❌ NO                  | Partially fixed bookings |
| `v3.1-date-corrected`           | Improved date handling     | ❌ NO                  | Better date logic        |
| `v3.4-calendar-database-synced` | Latest calendar sync       | ❌ NO                  | **Current standard**     |

## 🏗️ **How Sync Versions Affect Your System**

### **1. Dashboard Display (`src/pages/Dashboard.js`)**

```javascript
const needsCorrection =
  !isNewFixedBooking &&
  (!syncVersion ||
    (!syncVersion.includes("v3.1-date-corrected") &&
      !syncVersion.includes("v3.4-calendar-database-synced")));

if (needsCorrection) {
  // Add +1 day to fix old booking dates
  correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
}
```

### **2. Home Page Time Blocking (`src/pages/index.js`)**

```javascript
const needsCorrection =
  !isNewFixedBooking &&
  (!booking.syncVersion ||
    (!booking.syncVersion.includes("v3.1-date-corrected") &&
      !booking.syncVersion.includes("v3.4-calendar-database-synced")));
```

### **3. Time Slot Computation (`src/utils/bookingHelpers.js`)**

```javascript
const needsCorrection =
  !isNewFixedBooking &&
  (!booking.syncVersion ||
    (!booking.syncVersion.includes("v3.1-date-corrected") &&
      !booking.syncVersion.includes("v3.4-calendar-database-synced")));
```

## 📝 **Do We Need to Manually Enter Sync Versions?**

### **Automatic Assignment** ✅

- **New bookings**: Automatically get `v3.4-calendar-database-synced`
- **Calendar webhooks**: Automatically assign appropriate sync version
- **API endpoints**: Include sync version in booking creation

### **Manual Assignment** ⚠️

- **Legacy data**: Old bookings without sync versions need manual classification
- **Data migration**: When importing from external sources
- **Debug/fix scenarios**: When correcting problematic bookings

## 🔄 **How Sync Versions Change**

### **Automatic Changes**

1. **New Bookings**: Always get the latest sync version
2. **Calendar Sync**: Get `v3.4-calendar-database-synced`
3. **API Updates**: Version increments with major fixes

### **Manual Changes** (When Needed)

```javascript
// Example: Update a booking's sync version
await Booking.updateOne(
  { _id: bookingId },
  { syncVersion: "v3.4-calendar-database-synced" }
);
```

## 🚨 **What Caused This Manual Fix Need?**

### **Root Causes**

1. **Mixed Data Sources**:

   - Website bookings (one format)
   - Google Calendar imports (different format)
   - Manual entries (various formats)

2. **Timezone Evolution**:

   - Started with basic date handling
   - Added timezone corrections
   - Improved with calendar sync
   - Each change created "generations" of data

3. **Brittany's Case Study**:
   - Booking stored as: June 25th, 2025
   - Sync version: `v3.4-calendar-database-synced`
   - Problem: System was still applying +1 day correction
   - Fix: Added sync version check to prevent unnecessary correction

## 🛠️ **How to Handle in Future**

### **1. New Feature Development**

```javascript
// Always include sync version in new bookings
const newBooking = {
  // ... other fields
  syncVersion: "v3.5-new-feature-name", // Increment version
  createdAt: new Date(),
};
```

### **2. Data Migration Strategy**

```javascript
// When making breaking changes, migrate existing data
async function migrateBookings() {
  const oldBookings = await Booking.find({
    syncVersion: { $exists: false },
  });

  for (const booking of oldBookings) {
    // Analyze and assign appropriate sync version
    booking.syncVersion = determineSyncVersion(booking);
    await booking.save();
  }
}
```

### **3. Version Management Best Practices**

#### **Naming Convention**

- Format: `v{major}.{minor}-{feature-description}`
- Examples:
  - `v3.4-calendar-database-synced`
  - `v3.5-timezone-fix`
  - `v4.0-new-booking-system`

#### **Backward Compatibility**

```javascript
// Always check for multiple versions
const isFixed =
  syncVersion &&
  (syncVersion.includes("v3.1-date-corrected") ||
    syncVersion.includes("v3.4-calendar-database-synced") ||
    syncVersion.includes("v3.5-new-fix")); // Add new versions here
```

### **4. Future-Proofing Code**

#### **Centralized Version Check**

```javascript
// Create a utility function
function needsDateCorrection(syncVersion) {
  const fixedVersions = [
    "v3.1-date-corrected",
    "v3.4-calendar-database-synced",
    "v3.5-future-fix", // Add new versions here
  ];

  return !syncVersion || !fixedVersions.some((v) => syncVersion.includes(v));
}
```

#### **Version Registry**

```javascript
const SYNC_VERSIONS = {
  LEGACY: null,
  TIMEZONE_FIXED: "v2.5-date-timezone-fixed",
  DATE_CORRECTED: "v3.1-date-corrected",
  CALENDAR_SYNCED: "v3.4-calendar-database-synced",
  CURRENT: "v3.4-calendar-database-synced", // Update this for new versions
};
```

## 📊 **Monitoring and Maintenance**

### **Regular Checks**

1. **Version Distribution**: Monitor which sync versions are in use
2. **Data Consistency**: Verify dates display correctly for all versions
3. **Performance**: Ensure version checks don't slow down queries

### **Cleanup Strategy**

```javascript
// Periodically update old bookings to latest version (if safe)
async function cleanupOldVersions() {
  const oldBookings = await Booking.find({
    syncVersion: { $in: [null, "v2.5-date-timezone-fixed"] },
    createdAt: { $lt: new Date("2024-01-01") }, // Only very old bookings
  });

  // Carefully migrate after thorough testing
}
```

## ⚠️ **Important Warnings**

### **Never Do This**

- ❌ Remove sync version checks without migration
- ❌ Change sync versions on existing bookings without testing
- ❌ Assume all bookings use the same date format

### **Always Do This**

- ✅ Test date display for all sync versions
- ✅ Include sync version in new booking creation
- ✅ Document any changes to version logic
- ✅ Backup database before major version changes

## 🎯 **Quick Reference for Developers**

### **Adding New Sync Version**

1. Define new version constant
2. Update booking creation code
3. Add version check to all date formatting functions
4. Test with existing data
5. Document the change

### **Debugging Date Issues**

1. Check booking's sync version
2. Verify which date correction logic applies
3. Test in dashboard, home page, and blocking functions
4. Ensure consistency across all components

### **Emergency Fix Process**

1. Identify affected sync versions
2. Add version check to prevent issues
3. Test thoroughly
4. Deploy and monitor
5. Plan proper migration for next release

This sync version system ensures your booking dates remain accurate and consistent as your application evolves, preventing the kind of date mismatches you experienced with Brittany's booking.
