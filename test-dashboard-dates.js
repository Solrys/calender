const fetch = require("node-fetch");
const { format } = require("date-fns");

async function testDashboardDates() {
  console.log("🧪 Testing Dashboard Date Display...\n");

  try {
    // Test the API that the dashboard uses
    const response = await fetch("http://localhost:3001/api/booking");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data && data.bookings) {
      console.log(`📊 Found ${data.bookings.length} total bookings\n`);

      // Find Tatiana's booking
      const tatianaBooking = data.bookings.find(
        (b) =>
          b.customerName && b.customerName.toLowerCase().includes("tatiana")
      );

      if (tatianaBooking) {
        console.log("🎯 Tatiana Booking Found:");
        console.log("📅 Start Date (raw):", tatianaBooking.startDate);
        console.log("🕐 Start Time:", tatianaBooking.startTime);
        console.log("🕑 End Time:", tatianaBooking.endTime);
        console.log("👤 Customer:", tatianaBooking.customerName);

        // Test how JavaScript will interpret this date
        const date = new Date(tatianaBooking.startDate);
        console.log("\n🌍 How this displays in different timezones:");
        console.log("🔸 UTC:", date.toISOString().split("T")[0]);
        console.log("🔸 Your timezone:", date.toLocaleDateString());
        console.log(
          "🔸 Eastern Time:",
          date.toLocaleDateString("en-US", { timeZone: "America/New_York" })
        );
        console.log(
          "🔸 Pacific Time (LA):",
          date.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })
        );

        console.log("\n✅ Expected: July 28, 2025 (to match Google Calendar)");

        // Test the formatInTimeZone function that we're using in the dashboard
        const { formatInTimeZone } = require("date-fns-tz");
        const easternDate = formatInTimeZone(
          new Date(tatianaBooking.startDate),
          "America/New_York",
          "MMM d, yyyy"
        );
        console.log("🎯 Dashboard will show:", easternDate);
      } else {
        console.log("❌ Tatiana booking not found in API response");

        // Show first few bookings for debugging
        console.log("\n🔍 First few bookings:");
        data.bookings.slice(0, 3).forEach((booking, idx) => {
          console.log(
            `${idx + 1}. ${booking.customerName} - ${booking.startDate}`
          );
        });
      }
    } else {
      console.log("❌ No bookings data in API response");
    }
  } catch (error) {
    console.error("❌ Error testing dashboard:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.log(
        "💡 Make sure the development server is running: npm run dev"
      );
    }
  }
}

// Test Dashboard Date Formatting
// This script tests the formatDateForDisplay function with Brittany's booking data

// Copy of the fixed formatDateForDisplay function from Dashboard.js
const formatDateForDisplay = (dateString, syncVersion, paymentStatus) => {
  // Extract date from ISO string to avoid timezone conversion
  const isoDate = new Date(dateString).toISOString();
  const datePart = isoDate.split("T")[0]; // Gets "2025-07-28"
  const [year, month, day] = datePart.split("-");

  // SAFER LOGIC: Only bookings with the SPECIFIC new sync version are already correct
  // This prevents affecting existing manual bookings that might be working correctly
  const isNewFixedBooking = syncVersion === "v2.5-date-timezone-fixed";

  // Only add +1 day for bookings that haven't been corrected yet
  // BUT NOT for bookings created with the new timezone-fixed handler
  const needsCorrection =
    !isNewFixedBooking &&
    (!syncVersion ||
      (!syncVersion.includes("v3.1-date-corrected") &&
        !syncVersion.includes("v3.4-calendar-database-synced")));

  console.log(`🔍 TESTING: ${dateString}`);
  console.log(`   Sync Version: ${syncVersion || "No sync version"}`);
  console.log(`   Is New Fixed Booking: ${isNewFixedBooking}`);
  console.log(`   Needs Correction: ${needsCorrection}`);

  if (needsCorrection) {
    // DASHBOARD FIX: Add +1 day to match Google Calendar display for uncorrected bookings
    const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
    correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);

    // Convert to local date for formatting
    const localDate = new Date(
      correctedDate.getUTCFullYear(),
      correctedDate.getUTCMonth(),
      correctedDate.getUTCDate()
    );
    const result = format(localDate, "MMM d, yyyy");
    console.log(`   ✅ RESULT (with +1 day): ${result}\n`);
    return result;
  } else {
    // For new fixed bookings, use the date as-is (no +1 day correction)
    const localDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );
    const result = format(localDate, "MMM d, yyyy");
    console.log(`   ✅ RESULT (as-is): ${result}\n`);
    return result;
  }
};

console.log("🧪 TESTING DASHBOARD DATE FORMATTING");
console.log("====================================\n");

// Test cases for different sync versions
const testCases = [
  {
    name: "Brittany Alexander (v3.4-calendar-database-synced)",
    dateString: "2025-06-25T04:00:00.000+00:00", // This is the MongoDB date
    syncVersion: "v3.4-calendar-database-synced",
    expected: "Jun 25, 2025",
  },
  {
    name: "Old Booking (no sync version)",
    dateString: "2025-06-25T04:00:00.000+00:00",
    syncVersion: null,
    expected: "Jun 26, 2025", // Should get +1 day
  },
  {
    name: "v3.1 Corrected Booking",
    dateString: "2025-06-25T04:00:00.000+00:00",
    syncVersion: "v3.1-date-corrected",
    expected: "Jun 25, 2025",
  },
  {
    name: "v2.5 Fixed Booking",
    dateString: "2025-06-25T04:00:00.000+00:00",
    syncVersion: "v2.5-date-timezone-fixed",
    expected: "Jun 25, 2025",
  },
];

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. Testing: ${testCase.name}`);
  const result = formatDateForDisplay(
    testCase.dateString,
    testCase.syncVersion
  );
  const isCorrect = result === testCase.expected;

  console.log(`   Expected: ${testCase.expected}`);
  console.log(`   Got: ${result}`);
  console.log(`   ${isCorrect ? "✅ PASS" : "❌ FAIL"}\n`);
});

console.log("🎯 SUMMARY:");
console.log("==========");
console.log(
  'The fix ensures that bookings with sync version "v3.4-calendar-database-synced"'
);
console.log("will display the correct date without the +1 day adjustment.");
console.log(
  "\nBrittany Alexander's booking should now show June 25, 2025 instead of June 26, 2025."
);

testDashboardDates();
