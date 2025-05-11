import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get uploads directory
const uploadsDir = path.join(__dirname, "../../public/uploads");
const productsDir = path.join(uploadsDir, "products");
const ordersDir = path.join(uploadsDir, "orders");

/**
 * Check if a file is older than the specified time (in minutes)
 * @param {string} filePath - Path to the file
 * @param {number} minutes - Age in minutes
 * @returns {boolean} - Whether the file is older than the specified time
 */
const isFileOlderThan = (filePath, minutes) => {
    try {
        const stats = fs.statSync(filePath);
        const fileTime = new Date(stats.mtime).getTime();
        const currentTime = new Date().getTime();
        const minutesInMs = minutes * 60 * 1000;

        return (currentTime - fileTime) > minutesInMs;
    } catch (err) {
        console.error(`Error checking file age: ${filePath}`, err);
        return false;
    }
};

/**
 * Delete all temporary files older than the specified time
 * @param {string} directory - Directory to clean
 * @param {number} minutes - Delete files older than this many minutes
 */
const cleanupDirectory = (directory, minutes = 60) => {
    try {
        if (!fs.existsSync(directory)) return;

        console.log(`🧹 Cleaning up directory: ${directory}`);
        const files = fs.readdirSync(directory);
        
        let deletedCount = 0;
        let errorCount = 0;
        
        for (const file of files) {
            const filePath = path.join(directory, file);
            
            // Skip directories
            if (fs.statSync(filePath).isDirectory()) continue;
            
            // Delete if file is older than the specified time
            if (isFileOlderThan(filePath, minutes)) {
                try {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                } catch (err) {
                    console.error(`Error deleting file: ${filePath}`, err);
                    errorCount++;
                }
            }
        }
        
        console.log(`✅ Cleanup complete for ${directory}: ${deletedCount} files deleted, ${errorCount} errors`);
    } catch (err) {
        console.error(`Error cleaning directory ${directory}:`, err);
    }
};

/**
 * Run cleanup on all upload directories
 */
export const cleanupAllTempFiles = () => {
    console.log('🧹 Starting cleanup of temporary files...');
    
    // Clean up product images (older than 1 hour)
    cleanupDirectory(productsDir, 60);
    
    // Clean up order attachments (older than 1 hour)
    cleanupDirectory(ordersDir, 60);
    
    console.log('✅ Cleanup completed for all directories');
};

/**
 * Schedule cleanup at 2 AM IST (Indian Standard Time) every day
 */
export const scheduleDailyCleanup = () => {
    // Function to calculate ms until 2 AM IST
    const getMsUntil2AmIST = () => {
        // Get current time in UTC
        const now = new Date();
        
        // Create today's 2 AM IST time (which is 20:30 UTC from previous day)
        // IST is UTC+5:30
        const target = new Date(now);
        target.setUTCHours(20);
        target.setUTCMinutes(30);
        target.setUTCSeconds(0);
        target.setUTCMilliseconds(0);
        
        // If it's already past 2 AM IST today, schedule for tomorrow
        if (now > target) {
            target.setUTCDate(target.getUTCDate() + 1);
        }
        
        // Calculate ms until target time
        const msUntil2Am = target.getTime() - now.getTime();
        return msUntil2Am;
    };
    
    // Function to schedule next day's cleanup
    const scheduleNextCleanup = () => {
        const msUntil2Am = getMsUntil2AmIST();
        const hoursUntil = Math.floor(msUntil2Am / (1000 * 60 * 60));
        const minutesUntil = Math.floor((msUntil2Am % (1000 * 60 * 60)) / (1000 * 60));
        
        console.log(`🔄 Scheduling next cleanup at 2:00 AM IST (in ${hoursUntil} hours and ${minutesUntil} minutes)`);
        
        setTimeout(() => {
            cleanupAllTempFiles();
            scheduleNextCleanup(); // Schedule next day's cleanup after finishing
        }, msUntil2Am);
    };
    
    // Start the first cleanup schedule
    scheduleNextCleanup();
    
    // Also run a cleanup immediately when server starts
    console.log('🧹 Running initial cleanup on server start');
    cleanupAllTempFiles();
};

export default {
    cleanupAllTempFiles,
    scheduleDailyCleanup
}; 