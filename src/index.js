import dotenv from 'dotenv';
// Load environment variables first
dotenv.config({ path: './.env'});

import DBConnect from "./db/index.js"
import {app} from './app.js'
import { validateAuthEnvVariables } from './utils/config.js';

// Use PORT from environment (Render sets this automatically)
const port = process.env.PORT || 8000;

// Validate required environment variables
try {
    validateAuthEnvVariables();
} catch (error) {
    console.error("⚠️ Environment validation failed:", error.message);
    console.error("Please update your .env file with the required variables");
    // Don't exit in production, as some env vars might be set differently
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
}

DBConnect()
.then(() => {
    app.listen(port, () => {
        console.log(`✅ Server running at port: ${port}`);
        console.log(`🛣️ API routes available at /api/v1/`);
        console.log(`📚 API documentation available at /api-docs`);
    })
})
.catch((err) => {
    console.log("❌ MongoDB connection failed ", err);
    process.exit(1);
})
