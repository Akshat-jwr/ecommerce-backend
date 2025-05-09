import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";

/**
 * Global error handler middleware with security logging
 */
const errorMiddleware = (err, req, res, next) => {
    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || "Something went wrong";
    let errors = err.errors || [];
    
    // Additional info for logging
    const errorInfo = {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        statusCode,
        userId: req.user?._id || "unauthenticated"
    };
    
    // Handle specific error types
    
    // Mongoose validation error
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = "Validation Error";
        errors = Object.values(err.errors).map(e => e.message);
        logger.error("Mongoose Validation Error", { ...errorInfo, validationErrors: errors });
    }
    
    // Mongoose cast error (invalid ObjectId)
    else if (err.name === "CastError") {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
        logger.error("Invalid Data Format", { ...errorInfo, path: err.path, value: err.value });
    }
    
    // Mongoose duplicate key error
    else if (err.code === 11000) {
        statusCode = 409;
        message = `Duplicate value for ${Object.keys(err.keyValue).join(", ")}`;
        logger.error("Duplicate Key Error", { ...errorInfo, keyValue: err.keyValue });
    }
    
    // JWT errors
    else if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid token";
        // Log potential security issue
        logger.security("INVALID_TOKEN", "Invalid JWT token used", { 
            ...errorInfo,
            error: err.message
        });
    }
    
    else if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Token expired";
        logger.info("Token Expired", errorInfo);
    }
    
    // File upload errors
    else if (err.name === "MulterError") {
        statusCode = 400;
        message = err.message;
        logger.error("File Upload Error", { ...errorInfo, multerError: err.code });
    }
    
    // Validation errors from express-validator
    else if (err.statusCode === 400 && err.errors && Array.isArray(err.errors)) {
        logger.error("Request Validation Error", { ...errorInfo, validationErrors: err.errors });
    }
    
    // Log all 500 errors as they are the most serious
    else if (statusCode === 500) {
        logger.error("Server Error", { 
            ...errorInfo,
            stack: err.stack,
            originalError: err.originalError || err
        });
    }
    
    // Log possible security issues (403, 401 errors)
    else if (statusCode === 401 || statusCode === 403) {
        logger.security(
            statusCode === 401 ? "UNAUTHORIZED_ACCESS" : "FORBIDDEN_ACCESS",
            `${statusCode === 401 ? "Unauthorized" : "Forbidden"} access attempt`,
            errorInfo
        );
    }
    
    // Log all other errors
    else {
        logger.error(message, { ...errorInfo, error: err });
    }
    
    // Send standardized error response
    res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors: errors.length > 0 ? errors : undefined,
        // Only show stack trace in development
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
};

export { errorMiddleware }; 