import helmet from "helmet";
import rateLimit from "express-rate-limit";
import xss from "xss-clean";
import hpp from "hpp";

// Configure helmet for security headers
export const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "*.cloudinary.com"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"]
        }
    },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: "same-origin" }
});

// Rate limiter for general API requests
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes"
    }
});

// Stricter rate limiting for auth endpoints
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many auth attempts from this IP, please try again after an hour"
    }
});

// XSS protection middleware
export const xssProtection = xss();

// HTTP Parameter Pollution protection
export const parameterPollutionProtection = hpp();

// JWT cookie configuration with enhanced security
export const secureCookieConfig = {
    httpOnly: true, // Cannot be accessed by client-side JS
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // Restrict to same site to prevent CSRF
    maxAge: process.env.ACCESS_TOKEN_EXPIRY ? parseInt(process.env.ACCESS_TOKEN_EXPIRY) * 1000 : 24 * 60 * 60 * 1000 // Match token expiry
}; 