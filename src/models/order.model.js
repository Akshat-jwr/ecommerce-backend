import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    name: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true
    },
    customizations: {
        engravingText: String,
        imageUrl: String
    }
});

const shippingAddressSchema = new mongoose.Schema({
    label: String,
    street: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    postalCode: {
        type: String,
        required: true
    }
});

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [orderItemSchema],
    shippingAddress: shippingAddressSchema,
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["Placed", "Processing", "Shipped", "Delivered", "Cancelled"],
        default: "Placed"
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed", "Refunded"],
        default: "Pending"
    },
    paymentMethod: {
        type: String,
        enum: ["COD", "Credit Card", "Debit Card", "UPI"],
        required: true
    },
    trackingInfo: {
        carrier: String,
        trackingNumber: String,
        url: String
    },
    notes: String
}, { timestamps: true });

// Method to calculate order total
orderSchema.methods.calculateTotal = function() {
    return this.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
};

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus) {
    const validStatusTransitions = {
        "Placed": ["Processing", "Cancelled"],
        "Processing": ["Shipped", "Cancelled"],
        "Shipped": ["Delivered", "Cancelled"],
        "Delivered": [],
        "Cancelled": []
    };

    if (validStatusTransitions[this.status].includes(newStatus)) {
        this.status = newStatus;
        return true;
    }
    return false;
};

export const Order = mongoose.model("Order", orderSchema); 