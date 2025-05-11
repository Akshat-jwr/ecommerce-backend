import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

/**
 * Safely delete a file from the filesystem
 * @param {string} filePath - Path to the file to delete
 * @returns {boolean} - Whether deletion was successful
 */
const safeDeleteFile = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ Temporary file deleted: ${filePath}`);
            return true;
        }
    } catch (error) {
        console.error(`❌ Error deleting temporary file ${filePath}:`, error);
    }
    return false;
};

/**
 * Upload file to Cloudinary
 * @param {string} localFilePath - Path to local file
 * @param {string} folder - Cloudinary folder to upload to
 * @returns {Promise<Object>} Cloudinary response
 */
export const uploadOnCloudinary = async (localFilePath, folder = "products") => {
    try {
        if (!localFilePath) return null;
        
        // Verify file exists before attempting upload
        if (!fs.existsSync(localFilePath)) {
            console.error(`File not found at path: ${localFilePath}`);
            return null;
        }
        
        // Upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: folder
        });
        
        // File has been uploaded successfully
        console.log(`File uploaded to Cloudinary: ${response.public_id} (${response.url})`);
        
        // Remove locally saved file
        safeDeleteFile(localFilePath);
        
        return response;
    } catch (error) {
        console.error(`Error uploading to Cloudinary (${localFilePath}):`, error);
        
        // Remove locally saved file on upload failure
        safeDeleteFile(localFilePath);
        
        return null;
    }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of file to delete
 * @returns {Promise<Object>} Cloudinary response
 */
export const deleteFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return null;
        
        const response = await cloudinary.uploader.destroy(publicId);
        return response;
    } catch (error) {
        console.error("Error deleting from cloudinary:", error);
        return null;
    }
};

/**
 * Cleanup temporary upload files 
 * @param {Array} files - Array of file objects from multer
 */
export const cleanupTempFiles = (files) => {
    if (!files) return;
    
    // Handle both single file and array of files
    const filesToClean = Array.isArray(files) ? files : [files];
    
    filesToClean.forEach(file => {
        if (file && file.path) {
            safeDeleteFile(file.path);
        }
    });
};

/**
 * Get optimized URL for an image
 * @param {string} publicId - Public ID of image
 * @param {Object} options - Transformation options
 * @returns {string} Optimized URL
 */
export const getOptimizedImageUrl = (publicId, options = {}) => {
    const defaultOptions = {
        fetch_format: 'auto',
        quality: 'auto'
    };
    
    return cloudinary.url(publicId, { ...defaultOptions, ...options });
};