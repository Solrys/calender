import dbConnect from "@/lib/dbConnect";
import Booking from "@/models/Booking";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        console.log('🔧 Starting bulk date fix...');

        // Connect to database
        await dbConnect();

        // Find all calendar-synced bookings
        const calendarBookings = await Booking.find({
            calendarEventId: { $exists: true, $ne: null, $ne: '' }
        });

        console.log(`📊 Found ${calendarBookings.length} calendar-synced bookings`);

        let fixedCount = 0;
        let errorCount = 0;
        const results = [];

        for (const booking of calendarBookings) {
            try {
                // Current date
                const currentDate = new Date(booking.startDate);
                const currentDateStr = currentDate.toISOString().split('T')[0];

                // Add 1 day to match Google Calendar
                const fixedDate = new Date(currentDate);
                fixedDate.setDate(fixedDate.getDate() + 1);
                const fixedDateStr = fixedDate.toISOString().split('T')[0];

                // Update the booking
                await Booking.findByIdAndUpdate(booking._id, {
                    startDate: fixedDate
                });

                fixedCount++;
                results.push({
                    name: booking.customerName || 'No Name',
                    before: currentDateStr,
                    after: fixedDateStr,
                    status: 'Fixed'
                });

                console.log(`✅ Fixed: ${booking.customerName || 'No Name'} - ${currentDateStr} → ${fixedDateStr}`);

            } catch (error) {
                errorCount++;
                results.push({
                    name: booking.customerName || 'No Name',
                    before: booking.startDate,
                    after: 'Error',
                    status: 'Error: ' + error.message
                });
                console.error(`❌ Error fixing ${booking.customerName}:`, error.message);
            }
        }

        console.log(`🎉 Bulk fix complete: ${fixedCount} fixed, ${errorCount} errors`);

        return res.status(200).json({
            success: true,
            message: 'Bulk date fix completed',
            totalBookings: calendarBookings.length,
            fixed: fixedCount,
            errors: errorCount,
            results: results.slice(0, 10) // Show first 10 results
        });

    } catch (error) {
        console.error('❌ Bulk fix error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error during bulk fix',
            error: error.message
        });
    }
} 