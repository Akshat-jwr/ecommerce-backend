import mongoose from "mongoose";
import { PAYMENT_METHODS, ORDER_STATUS, PAYMENT_STATUS } from "../constants/index.js";

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    //I've kept this price to adjust for discounts
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
    deliveryCharge: {
        type: Number,
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
        enum: Object.values(ORDER_STATUS),
        default: ORDER_STATUS.PLACED
    },
    paymentStatus: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.PENDING
    },
    paymentMethod: {
        type: String,
        enum: Object.values(PAYMENT_METHODS),
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

// Pre-save hook to delete attachments when order is delivered
orderSchema.pre('save', async function(next) {
    // If order status has changed to Delivered or Cancelled, delete the attachments
    if (
        this.isModified('status') && 
        (this.status === ORDER_STATUS.DELIVERED || this.status === ORDER_STATUS.CANCELLED) && 
        this.attachments?.zipFilePath
    ) {
        try {
            const { deleteOrderAttachments } = await import('../utils/fileUpload.js');
            await deleteOrderAttachments(this._id.toString());
            this.attachments = undefined; // Remove reference to deleted files
        } catch (error) {
            console.error('Error deleting order attachments:', error);
        }
    }
    next();
});

// Method to calculate order total
orderSchema.methods.calculateTotal = function() {
    return this.items.reduce((total, item) => {
        return total + (item.price * item.quantity) + this.deliveryCharge;
    }, 0);
};

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus) {
    const validStatusTransitions = {
        [ORDER_STATUS.PLACED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
        [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
        [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
        [ORDER_STATUS.DELIVERED]: [],
        [ORDER_STATUS.CANCELLED]: []
    };

    if (validStatusTransitions[this.status].includes(newStatus)) {
        this.status = newStatus;
        return true;
    }
    return false;
};

export const Order = mongoose.model("Order", orderSchema); 