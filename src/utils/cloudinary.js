import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

/**
 * Upload file to Cloudinary
 * @param {string} localFilePath - Path to local file
 * @param {string} folder - Cloudinary folder to upload to
 * @returns {Promise<Object>} Cloudinary response
 */
export const uploadOnCloudinary = async (localFilePath, folder = "products") => {
    try {
        if (!localFilePath) return null;
        
        // Upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: folder
        });
        
        // File has been uploaded successfully
        // console.log("File uploaded on cloudinary:", response.url);
        
        // Remove locally saved file
        fs.unlinkSync(localFilePath);
        
        return response;
    } catch (error) {
        // Remove locally saved file on upload failure
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        
        console.error("Error uploading to cloudinary:", error);
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