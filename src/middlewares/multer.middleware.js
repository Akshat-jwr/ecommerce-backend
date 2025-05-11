import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { cleanupTempFiles } from "../utils/cloudinary.js";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../public/uploads");
const productsDir = path.join(uploadsDir, "products");
const ordersDir = path.join(uploadsDir, "orders");

// Ensure directories exist
[uploadsDir, productsDir, ordersDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Cleanup middleware to ensure files are deleted after request is processed
export const fileCleanupAfterResponse = (req, res, next) => {
    // Store original end method
    const originalEnd = res.end;
    
    // Override end method
    res.end = function() {
        // Call the original end method
        originalEnd.apply(res, arguments);
        
        // Clean up files
        if (req.files) {
            setTimeout(() => {
                cleanupTempFiles(req.files);
                console.log('🧹 Cleanup middleware executed - ensuring all temp files are deleted');
            }, 1000); // Small delay to ensure everything is processed
        }
    };
    
    next();
};

// Storage for product images (to be later uploaded to Cloudinary)
const productStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, productsDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Storage for order attachments that will be processed into zip files
const orderAttachmentStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const orderId = req.params.orderId;
        const orderDir = path.join(ordersDir, orderId);
        
        if (!fs.existsSync(orderDir)) {
            fs.mkdirSync(orderDir, { recursive: true });
        }
        
        cb(null, orderDir);
    },
    filename: function(req, file, cb) {
        // Keep original filename but ensure it's unique
        const uniqueSuffix = Date.now() + '-';
        cb(null, uniqueSuffix + file.originalname);
    }
});

// File filter for images
const imageFileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error("Only image files are allowed"));
    }
};

// File filter for order attachments - allow images and common document types
const orderFileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (extname) {
        return cb(null, true);
    } else {
        cb(new Error("Only image and document files are allowed"));
    }
};

// Create multer instances for different purposes
export const uploadProductImage = multer({
    storage: productStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: imageFileFilter
});

export const uploadOrderAttachments = multer({
    storage: orderAttachmentStorage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 20 // Max 20 files per upload
    },
    fileFilter: orderFileFilter
});

// Memory storage for handling files in memory before deciding what to do with them
const memoryStorage = multer.memoryStorage();

export const uploadToMemory = multer({
    storage: memoryStorage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    }
}); 