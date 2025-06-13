import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
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
  originalPrice: {
    type: Number,
    min: [0, "Original price cannot be negative"]
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, { _id: false });

const addressSchema = new mongoose.Schema({
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
    trim: true,
    default: "India"
  },
  phone: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const paymentInfoSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ["upi", "credit_card", "debit_card", "cash_on_delivery"]
  },
  transactionId: {
    type: String
  },
  paymentId: {
    type: String
  },
  gatewayOrderId: {
    type: String
  },
  gateway: {
    type: String,
    enum: ["razorpay", "stripe", "paypal"]
  },
  status: {
    type: String,
    required: true,
    enum: ["pending", "completed", "failed", "refunded"]
  },
  verifiedAt: {
    type: Date
  },
  refundId: {
    type: String
  },
  refundStatus: {
    type: String,
    enum: ["initiated", "completed", "failed"]
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  orderNumber: {
    type: String,
    unique: true,
    index: true
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
  billingAddress: {
    type: addressSchema
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
    enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"],
    default: "pending",
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  couponDetails: {
    code: String,
    discountAmount: Number,
    discountType: String
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });

// Virtual for order summary
orderSchema.virtual("itemCount").get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return ["pending", "confirmed"].includes(this.status);
};

// Method to check if order can be refunded
orderSchema.methods.canBeRefunded = function() {
  return ["delivered"].includes(this.status);
};

export const Order = mongoose.model("Order", orderSchema);
