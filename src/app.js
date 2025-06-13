import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import path from "path";
import { fileURLToPath } from "url";
import { scheduleDailyCleanup } from "./utils/cleanupTempFiles.js";
import userRoutes from "./routes/user.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

// Import security middlewares
import { 
    securityHeaders, 
    apiLimiter, 
    authLimiter, 
    xssProtection, 
    parameterPollutionProtection 
} from "./middlewares/security.middleware.js";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import publicRoutes from "./routes/public.routes.js";

// Import Swagger
import { swaggerDocs } from "./utils/swagger.js";
import logger from "./utils/logger.js";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for essential environment variables
const requiredEnvVars = [
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'ACCESS_TOKEN_EXPIRY',
    'REFRESH_TOKEN_EXPIRY',
    'MONGODB_URI',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    console.error('ERROR: Missing required environment variables:', missingEnvVars.join(', '));
    console.error('Please check your .env file');
    logger.error('Missing environment variables', { missing: missingEnvVars });
}

const app = express();

// Apply security middlewares first
app.use(securityHeaders);
app.use(xssProtection);
app.use(parameterPollutionProtection);

// Apply rate limiting - more restrictive for auth routes
app.use("/api/v1/auth", authLimiter);
// General rate limiting for all other routes
app.use("/api", apiLimiter);

// Global middlewares
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    // Enhanced CORS security
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // Cache preflight requests for 1 day
}));

// Increase JSON body size limit slightly but still keep it restricted
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));
app.use(cookieParser());

// Initialize Swagger - IMPORTANT: Initialize before routes
const PORT = process.env.PORT || 8000;
swaggerDocs(app, PORT);

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is running",
        timestamp: new Date()
    });
});

// Root endpoint - added for Render
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "E-commerce API is running",
        version: "1.0.0",
        docs: "/api-docs"
    });
});

// Mount routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/payment", paymentRoutes);
// app.use("/api/v1/products", productRoutes);
// ...

// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// Error handling middleware
app.use(errorMiddleware);

export { app };