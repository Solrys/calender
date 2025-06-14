import fs from 'fs';
import path from 'path';

// Path to watch info file
const WATCH_INFO_FILE = path.join(process.cwd(), 'current-watch-info.json');

// Function to read existing watch info
function getExistingWatchInfo() {
    try {
        if (fs.existsSync(WATCH_INFO_FILE)) {
            const watchData = fs.readFileSync(WATCH_INFO_FILE, 'utf8');
            return JSON.parse(watchData);
        }
    } catch (error) {
        console.log('⚠️ Could not read existing watch info:', error.message);
    }
    return null;
}

// Function to check if a watch is still valid
function isWatchValid(watchInfo) {
    if (!watchInfo || !watchInfo.expiration) {
        return false;
    }

    const now = Date.now();
    const expiration = parseInt(watchInfo.expiration);
    const timeUntilExpiration = expiration - now;

    // Consider valid if more than 1 hour remaining
    return timeUntilExpiration > 60 * 60 * 1000; // 1 hour in milliseconds
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        console.log('🔍 CHECKING CALENDAR WATCH STATUS');

        const existingWatch = getExistingWatchInfo();

        if (!existingWatch) {
            console.log('❌ No watch found');
            return res.status(200).json({
                status: 'no_watch',
                message: 'No calendar watch is currently registered',
                hasWatch: false
            });
        }

        const now = Date.now();
        const expiration = parseInt(existingWatch.expiration);
        const timeUntilExpiration = expiration - now;
        const hoursRemaining = Math.round(timeUntilExpiration / (60 * 60 * 1000));
        const isValid = isWatchValid(existingWatch);

        console.log(`📋 Watch Status: ${isValid ? 'VALID' : 'EXPIRED'}`);
        console.log(`   🆔 Channel ID: ${existingWatch.channelId}`);
        console.log(`   ⏰ Hours remaining: ${hoursRemaining}`);

        return res.status(200).json({
            status: isValid ? 'active' : 'expired',
            message: isValid ? 'Calendar watch is active and valid' : 'Calendar watch is expired or expiring soon',
            hasWatch: true,
            watchInfo: {
                channelId: existingWatch.channelId,
                resourceId: existingWatch.resourceId,
                registeredAt: existingWatch.registeredAt,
                expiration: existingWatch.expiration,
                expirationDate: new Date(expiration).toISOString(),
                hoursRemaining: hoursRemaining,
                isValid: isValid,
                webhookUrl: existingWatch.webhookUrl
            }
        });

    } catch (error) {
        console.error('❌ Error checking calendar watch:', error);
        return res.status(500).json({
            message: 'Error checking calendar watch status',
            error: error.message
        });
    }
} 