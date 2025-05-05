import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    discountType: {
        type: String,
        enum: ["percentage", "fixed"],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    expiryDate: {
        type: Date,
        required: true
    },
    minPurchaseAmount: {
        type: Number,
        default: 0
    },
    maxDiscountAmount: {
        type: Number,
        default: null
    },
    usageLimit: {
        type: Number,
        default: null
    },
    usedCount: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    applicableProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    }],
    applicableCategories: [String],
    usedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    description: String
}, { timestamps: true });

// Method to check if coupon is valid
couponSchema.methods.isValid = function() {
    const now = new Date();
    
    // Check if coupon is active
    if (!this.isActive) return false;
    
    // Check if coupon is expired
    if (this.expiryDate < now) return false;
    
    // Check if usage limit reached
    if (this.usageLimit !== null && this.usedCount >= this.usageLimit) return false;
    
    return true;
};

// Method to check if a user can use this coupon
couponSchema.methods.canBeUsedByUser = function(userId) {
    // Check if coupon has already been used by this user
    return !this.usedBy.includes(userId);
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function(cartTotal) {
    // Check if minimum purchase requirement is met
    if (cartTotal < this.minPurchaseAmount) return 0;
    
    let discount = 0;
    
    if (this.discountType === "percentage") {
        discount = (cartTotal * this.discountValue) / 100;
    } else {
        discount = this.discountValue;
    }
    
    // Apply maximum discount cap if set
    if (this.maxDiscountAmount !== null && discount > this.maxDiscountAmount) {
        discount = this.maxDiscountAmount;
    }
    
    return discount;
};

export const Coupon = mongoose.model("Coupon", couponSchema); 