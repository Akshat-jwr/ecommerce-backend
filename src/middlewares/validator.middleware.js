import { body, query, param, validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

// Common validation chains
export const userValidationRules = {
    email: body("email")
        .trim()
        .isEmail()
        .withMessage("Please enter a valid email address")
        .normalizeEmail(),
    
    password: body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
        .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
    
    name: body("name")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("Name must be between 2 and 50 characters"),
        
    phone: body("phone")
        .optional()
        .matches(/^[0-9]{10}$/)
        .withMessage("Please enter a valid 10-digit phone number")
};

// MongoDB ObjectId validation
export const isValidObjectId = (field) => 
    param(field)
        .isMongoId()
        .withMessage(`Invalid ${field} ID format`);

// Pagination validation
export const paginationRules = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100")
];

// Product validation rules
export const productValidationRules = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Product name is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Product name must be between 2 and 100 characters"),
    
    body("description")
        .trim()
        .notEmpty()
        .withMessage("Product description is required"),
    
    body("price")
        .isFloat({ min: 0 })
        .withMessage("Price must be a positive number"),
    
    body("stock")
        .isInt({ min: 0 })
        .withMessage("Stock must be a non-negative integer"),
        
    body("category")
        .isMongoId()
        .withMessage("Invalid category ID format"),
        
    body("discountPercentage")
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage("Discount percentage must be between 0 and 100")
];

// Category validation rules
export const categoryValidationRules = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Category name is required")
        .isLength({ min: 2, max: 50 })
        .withMessage("Category name must be between 2 and 50 characters"),
        
    body("parentCategory")
        .optional()
        .isMongoId()
        .withMessage("Invalid parent category ID format")
];

// Order status validation rules
export const orderStatusValidationRules = [
    body("status")
        .isIn(["pending", "processing", "shipped", "delivered", "cancelled", "refunded"])
        .withMessage("Invalid order status")
];

// Middleware to handle validation results
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    
    const extractedErrors = errors.array().map(err => ({
        [err.path]: err.msg
    }));
    
    throw new ApiError(400, "Validation Error", extractedErrors);
}; 