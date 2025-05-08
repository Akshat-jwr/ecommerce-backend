import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // OTP expires after 10 minutes (600 seconds)
    }
});

// Method to verify OTP
otpSchema.methods.verifyOTP = function(otpToVerify) {
    return this.otp === otpToVerify;
};

// Pre-save hook to set expiry
otpSchema.pre('save', function(next) {
    this.createdAt = Date.now();
    next();
});

export const OTP = mongoose.model("OTP", otpSchema); 