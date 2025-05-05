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
    },
    
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
    notes: String,
    attachments: {
        zipFilePath: String,
        uploadedAt: Date
    }
}, { timestamps: true });

orderSchema.pre('save', async function(next) {
    // If order status has changed to Delivered, delete the attachments
    if (this.isModified('status') && this.status === 'Delivered' && this.attachments?.zipFilePath) {
        try {
            const { deleteOrderFiles } = await import('../utils/fileUpload.js');
            await deleteOrderFiles(this._id);
            this.attachments = undefined; // Remove reference to deleted files
        } catch (error) {
            console.error('Error deleting order files:', error);
        }
    }
    next();
});

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