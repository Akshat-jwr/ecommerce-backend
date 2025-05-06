import { ApiError } from "../utils/ApiError.js";

/**
 * Global error handler middleware
 */
const errorMiddleware = (err, req, res, next) => {
    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || "Something went wrong";
    let errors = err.errors || [];
    
    // Handle specific error types
    
    // Mongoose validation error
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = "Validation Error";
        errors = Object.values(err.errors).map(e => e.message);
    }
    
    // Mongoose cast error (invalid ObjectId)
    if (err.name === "CastError") {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }
    
    // Mongoose duplicate key error
    if (err.code === 11000) {
        statusCode = 409;
        message = `Duplicate value for ${Object.keys(err.keyValue).join(", ")}`;
    }
    
    // JWT errors
    if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid token";
    }
    
    if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Token expired";
    }
    
    // File upload errors
    if (err.name === "MulterError") {
        statusCode = 400;
        message = err.message;
    }
    
    // Send standardized error response
    res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors: errors.length > 0 ? errors : undefined,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
};

export { errorMiddleware }; 