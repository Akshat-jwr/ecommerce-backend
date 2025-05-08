import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import path from "path";
import { fileURLToPath } from "url";

// Import routes
import authRoutes from "./routes/auth.routes.js";

// Import Swagger
import { swaggerDocs } from "./utils/swagger.js";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global middlewares
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));

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
// app.use("/api/v1/users", userRoutes);
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