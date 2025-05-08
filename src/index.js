import dotenv from 'dotenv';
// Load environment variables first
dotenv.config({ path: './.env'});

import DBConnect from "./db/index.js"
import {app} from './app.js'
import { validateAuthEnvVariables } from './utils/config.js';

const port = process.env.PORT || 8001;

// Validate required environment variables
try {
    validateAuthEnvVariables();
} catch (error) {
    console.error("⚠️ Environment validation failed:", error.message);
    console.error("Please update your .env file with the required variables");
    process.exit(1);
}

DBConnect()
.then(() => {
    app.listen(port, ()=>{
        console.log(`✅ Server running at http://localhost:${port}`);
        console.log(`🛣️  API routes available at http://localhost:${port}/api/v1/`);
    })
})
.catch((err) => {
    console.log("❌ MongoDB connection failed ", err);
    process.exit(1);
})
