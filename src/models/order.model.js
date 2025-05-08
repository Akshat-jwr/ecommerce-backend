import mongoose from "mongoose";
import { PAYMENT_METHODS, ORDER_STATUS, PAYMENT_STATUS } from "../constants/index.js";

const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, "Quantity cannot be less than 1"]
        },
        price: {
            type: Number,
            required: true,
            min: [0, "Price cannot be negative"]
        },
        customizations: {
            type: Object,
            default: {}
        }
    },
    { _id: false }
);

const addressSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        addressLine1: {
            type: String,
            required: true,
            trim: true
        },
        addressLine2: {
            type: String,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        postalCode: {
            type: String,
            required: true,
            trim: true
        },
        country: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        }
    },
    { _id: false }
);

const paymentInfoSchema = new mongoose.Schema(
    {
        method: {
            type: String,
            required: true,
            enum: ["credit_card", "paypal", "stripe", "bank_transfer", "cash_on_delivery"]
        },
        transactionId: {
            type: String
        },
        status: {
            type: String,
            required: true,
            enum: ["pending", "completed", "failed", "refunded"]
        }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: function(items) {
                    return items.length > 0;
                },
                message: "Order must contain at least one item"
            }
        },
        shippingAddress: {
            type: addressSchema,
            required: true
        },
        paymentInfo: {
            type: paymentInfoSchema,
            required: true
        },
        subtotal: {
            type: Number,
            required: true,
            min: [0, "Subtotal cannot be negative"]
        },
        tax: {
            type: Number,
            required: true,
            min: [0, "Tax cannot be negative"]
        },
        shipping: {
            type: Number,
            required: true,
            min: [0, "Shipping cost cannot be negative"]
        },
        discount: {
            type: Number,
            required: true,
            default: 0,
            min: [0, "Discount cannot be negative"]
        },
        total: {
            type: Number,
            required: true,
            min: [0, "Total cannot be negative"]
        },
        status: {
            type: String,
            required: true,
            enum: ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"],
            default: "pending"
        },
        notes: {
            type: String,
            trim: true
        },
        trackingNumber: {
            type: String,
            trim: true
        }
    },
    { timestamps: true }
);

// Calculate order total
orderSchema.pre("save", function(next) {
    if (!this.isModified("items") && !this.isModified("tax") && 
        !this.isModified("shipping") && !this.isModified("discount")) {
        return next();
    }
    
    // Calculate subtotal from items
    this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Calculate total
    this.total = this.subtotal + this.tax + this.shipping - this.discount;
    
    next();
});

// Virtual for order number (formatted ID)
orderSchema.virtual("orderNumber").get(function() {
    return `ORD-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
    return ["pending", "processing"].includes(this.status);
};

// Method to check if order can be refunded
orderSchema.methods.canBeRefunded = function() {
    return ["delivered"].includes(this.status);
};

// Include virtuals when converting to JSON
orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

export const Order = mongoose.model("Order", orderSchema); 