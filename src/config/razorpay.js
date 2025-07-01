// src/config/razorpay.js

import Razorpay from "razorpay";
import logger from "../utils/logger.js";

// Check for Razorpay credentials in environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  logger.error("FATAL ERROR: Razorpay Key ID or Key Secret is not defined in .env file.");
  process.exit(1); // Exit the application if credentials are not found
}

// Create and export the single, configured Razorpay instance
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
