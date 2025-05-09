import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const accessLogPath = path.join(logsDir, "access.log");
const errorLogPath = path.join(logsDir, "error.log");
const securityLogPath = path.join(logsDir, "security.log");

/**
 * Format log entry with timestamp
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 * @returns {string} Formatted log entry
 */
const formatLogEntry = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logData = typeof data === 'object' ? JSON.stringify(data) : data;
    return `[${timestamp}] [${level}] ${message} ${logData}\n`;
};

/**
 * Write to log file
 * @param {string} filePath - Path to log file
 * @param {string} content - Content to write
 */
const writeToLog = (filePath, content) => {
    fs.appendFile(filePath, content, (err) => {
        if (err) {
            console.error(`Failed to write to log file: ${err.message}`);
        }
    });
};

/**
 * Log information message
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
export const info = (message, data = {}) => {
    const logEntry = formatLogEntry("INFO", message, data);
    writeToLog(accessLogPath, logEntry);
    if (process.env.NODE_ENV === "development") {
        console.log(`INFO: ${message}`, data);
    }
};

/**
 * Log error message
 * @param {string} message - Error message
 * @param {Object|Error} data - Error object or additional data
 */
export const error = (message, data = {}) => {
    let logData = data;
    
    // Extract stack trace if data is an Error object
    if (data instanceof Error) {
        logData = {
            message: data.message,
            stack: data.stack,
            ...data
        };
    }
    
    const logEntry = formatLogEntry("ERROR", message, logData);
    writeToLog(errorLogPath, logEntry);
    if (process.env.NODE_ENV === "development") {
        console.error(`ERROR: ${message}`, data);
    }
};

/**
 * Log security event
 * @param {string} event - Security event type
 * @param {string} message - Security event message
 * @param {Object} data - Additional data about the security event
 */
export const security = (event, message, data = {}) => {
    const securityData = {
        event,
        ...data,
        timestamp: new Date().toISOString()
    };
    
    const logEntry = formatLogEntry("SECURITY", message, securityData);
    writeToLog(securityLogPath, logEntry);
    
    // Always log security events to console in any environment
    console.warn(`SECURITY [${event}]: ${message}`);
};

// Export logger
export default {
    info,
    error,
    security
}; 