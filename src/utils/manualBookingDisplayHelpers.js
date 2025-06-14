// MANUAL BOOKING SPECIFIC HELPERS
// These functions are ONLY for manual calendar bookings and won't affect website bookings

/**
 * Format date for display - MANUAL BOOKINGS ONLY
 * This function specifically handles manual bookings created through Google Calendar
 */
export function formatManualBookingDateForDisplay(dateString, syncVersion, paymentStatus) {
    // SAFETY CHECK: Only apply to manual bookings
    if (paymentStatus !== 'manual') {
        // For non-manual bookings, use the original logic
        return formatOriginalDateForDisplay(dateString, syncVersion, paymentStatus);
    }

    // Extract date from ISO string to avoid timezone conversion
    const isoDate = new Date(dateString).toISOString();
    const datePart = isoDate.split('T')[0]; // Gets "2025-07-30"
    const [year, month, day] = datePart.split('-');

    // MANUAL BOOKING LOGIC: Only new manual bookings with specific sync version are correct
    const isNewManualBookingFixed = syncVersion === 'v2.5-date-timezone-fixed';

    // Only add +1 day for OLD manual bookings that haven't been corrected yet
    const needsCorrection = !isNewManualBookingFixed &&
        (!syncVersion ||
            !syncVersion.includes('v3.1-date-corrected'));

    if (needsCorrection) {
        // OLD MANUAL BOOKING: Add +1 day correction
        const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
        correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
        const localDate = new Date(correctedDate.getUTCFullYear(), correctedDate.getUTCMonth(), correctedDate.getUTCDate());
        return format(localDate, "MMM d, yyyy");
    } else {
        // NEW MANUAL BOOKING: Use date as-is (no correction needed)
        const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return format(localDate, "MMM d, yyyy");
    }
}

/**
 * Get date parts for filtering - MANUAL BOOKINGS ONLY
 */
export function getManualBookingDatePartsForFilter(dateString, syncVersion, paymentStatus) {
    // SAFETY CHECK: Only apply to manual bookings
    if (paymentStatus !== 'manual') {
        return getOriginalDatePartsForFilter(dateString, syncVersion, paymentStatus);
    }

    const isoDate = new Date(dateString).toISOString();
    const datePart = isoDate.split('T')[0];
    const [year, month, day] = datePart.split('-');

    // MANUAL BOOKING LOGIC: Only new manual bookings with specific sync version are correct
    const isNewManualBookingFixed = syncVersion === 'v2.5-date-timezone-fixed';
    const needsCorrection = !isNewManualBookingFixed &&
        (!syncVersion ||
            !syncVersion.includes('v3.1-date-corrected'));

    if (needsCorrection) {
        // OLD MANUAL BOOKING: Add +1 day correction
        const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
        correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
        return {
            year: correctedDate.getUTCFullYear().toString(),
            month: (correctedDate.getUTCMonth() + 1).toString().padStart(2, '0'),
            day: correctedDate.getUTCDate().toString().padStart(2, '0')
        };
    } else {
        // NEW MANUAL BOOKING: Use date as-is
        return {
            year: year,
            month: month,
            day: day
        };
    }
}

/**
 * Compute blocked times for manual bookings - MANUAL BOOKINGS ONLY
 */
export function computeManualBookingBlockedTimes(booking) {
    // SAFETY CHECK: Only apply to manual bookings
    if (booking.paymentStatus !== 'manual') {
        return computeOriginalBlockedTimes(booking);
    }

    const isoDate = new Date(booking.startDate).toISOString();
    const datePart = isoDate.split('T')[0];

    // MANUAL BOOKING LOGIC: Only new manual bookings with specific sync version are correct
    const isNewManualBookingFixed = booking.syncVersion === 'v2.5-date-timezone-fixed';
    const needsCorrection = !isNewManualBookingFixed &&
        (!booking.syncVersion ||
            !booking.syncVersion.includes('v3.1-date-corrected'));

    let dateKey;
    if (needsCorrection) {
        // OLD MANUAL BOOKING: Add +1 day correction
        const [year, month, day] = datePart.split('-');
        const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
        correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
        dateKey = correctedDate.toISOString().split('T')[0];
    } else {
        // NEW MANUAL BOOKING: Use date as-is
        dateKey = datePart;
    }

    return dateKey;
}

// FALLBACK FUNCTIONS FOR NON-MANUAL BOOKINGS (preserve original logic)
import { format } from "date-fns";

function formatOriginalDateForDisplay(dateString, syncVersion, paymentStatus) {
    // Original logic for website bookings - unchanged
    const isoDate = new Date(dateString).toISOString();
    const datePart = isoDate.split('T')[0];
    const [year, month, day] = datePart.split('-');

    const needsCorrection = !syncVersion || !syncVersion.includes('v3.1-date-corrected');

    if (needsCorrection) {
        const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
        correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
        const localDate = new Date(correctedDate.getUTCFullYear(), correctedDate.getUTCMonth(), correctedDate.getUTCDate());
        return format(localDate, "MMM d, yyyy");
    } else {
        const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return format(localDate, "MMM d, yyyy");
    }
}

function getOriginalDatePartsForFilter(dateString, syncVersion, paymentStatus) {
    // Original logic for website bookings - unchanged
    const isoDate = new Date(dateString).toISOString();
    const datePart = isoDate.split('T')[0];
    const [year, month, day] = datePart.split('-');

    const needsCorrection = !syncVersion || !syncVersion.includes('v3.1-date-corrected');

    if (needsCorrection) {
        const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
        correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
        return {
            year: correctedDate.getUTCFullYear().toString(),
            month: (correctedDate.getUTCMonth() + 1).toString().padStart(2, '0'),
            day: correctedDate.getUTCDate().toString().padStart(2, '0')
        };
    } else {
        return {
            year: year,
            month: month,
            day: day
        };
    }
}

function computeOriginalBlockedTimes(booking) {
    // Original logic for website bookings - unchanged
    const isoDate = new Date(booking.startDate).toISOString();
    const datePart = isoDate.split('T')[0];

    const needsCorrection = !booking.syncVersion || !booking.syncVersion.includes('v3.1-date-corrected');

    let dateKey;
    if (needsCorrection) {
        const [year, month, day] = datePart.split('-');
        const correctedDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
        correctedDate.setUTCDate(correctedDate.getUTCDate() + 1);
        dateKey = correctedDate.toISOString().split('T')[0];
    } else {
        dateKey = datePart;
    }

    return dateKey;
} 