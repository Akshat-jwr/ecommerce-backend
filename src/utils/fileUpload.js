import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for file paths
const uploadsDir = path.join(__dirname, "../../public/uploads");
const ordersDir = path.join(uploadsDir, "orders");

/**
 * Creates a zip file from files in a directory
 * @param {string} orderId - The order ID
 * @returns {Promise<string>} - Path to the created zip file
 */
export const createOrderAttachmentsZip = async (orderId) => {
    const orderDir = path.join(ordersDir, orderId);
    const zipPath = path.join(orderDir, `order-${orderId}-attachments.zip`);
    
    // Check if directory exists
    if (!fs.existsSync(orderDir)) {
        throw new Error(`No attachments found for order ${orderId}`);
    }
    
    // Get all files in directory
    const files = fs.readdirSync(orderDir).filter(file => {
        // Filter out the zip file itself if it exists
        return file !== `order-${orderId}-attachments.zip`;
    });
    
    if (files.length === 0) {
        throw new Error(`No attachments found for order ${orderId}`);
    }
    
    try {
        // Create zip file
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });
        
        // Set up event handlers
        return new Promise((resolve, reject) => {
            output.on('close', () => {
                console.log(`Zip created: ${zipPath} (${archive.pointer()} bytes)`);
                resolve(zipPath);
            });
            
            archive.on('error', (err) => {
                reject(err);
            });
            
            // Pipe archive data to output file
            archive.pipe(output);
            
            // Add each file to the archive
            files.forEach(file => {
                const filePath = path.join(orderDir, file);
                archive.file(filePath, { name: file });
            });
            
            // Finalize the archive
            archive.finalize();
        });
    } catch (error) {
        console.error("Error creating zip file:", error);
        throw error;
    }
};

/**
 * Gets the download URL for an order attachments zip
 * @param {string} orderId - The order ID
 * @returns {string} URL path to zip file
 */
export const getOrderAttachmentsZipUrl = (orderId) => {
    return `/uploads/orders/${orderId}/order-${orderId}-attachments.zip`;
};

/**
 * Deletes order attachments after order completion
 * @param {string} orderId - The order ID
 * @returns {Promise<boolean>} Whether deletion was successful
 */
export const deleteOrderAttachments = async (orderId) => {
    const orderDir = path.join(ordersDir, orderId);
    
    if (fs.existsSync(orderDir)) {
        try {
            fs.rmSync(orderDir, { recursive: true, force: true });
            return true;
        } catch (error) {
            console.error(`Error deleting order attachments for order ${orderId}:`, error);
            return false;
        }
    }
    
    return false;
}; 