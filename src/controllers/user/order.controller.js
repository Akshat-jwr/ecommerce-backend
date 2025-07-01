import { Order } from "../../models/order.model.js";
import { User } from "../../models/user.model.js";
import { Product } from "../../models/product.model.js";
import { UserActivity } from "../../models/userActivity.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";
import { razorpay } from "../../config/razorpay.js"; // Corrected import path for Razorpay instance

/**
 * Create order from cart with proper payment handling
 */
const createOrder = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const {
        shippingAddressId,
        billingAddressId,
        paymentMethod,
        notes,
        couponCode,
      } = req.body;

      const userId = req.user._id;

      if (!shippingAddressId || !paymentMethod) {
        throw new ApiError(400, "Shipping address and payment method are required");
      }

      const validPaymentMethods = ["upi", "credit_card", "debit_card", "cash_on_delivery"];
      if (!validPaymentMethods.includes(paymentMethod)) {
        throw new ApiError(400, "Invalid payment method");
      }

      const user = await User.findById(userId)
        .populate({
          path: "cart.items.productId",
          select: "name price stock discountPercentage images lowStockThreshold",
        })
        .session(session);

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      if (!user.cart.items || user.cart.items.length === 0) {
        throw new ApiError(400, "Cart is empty");
      }

      const shippingAddress = user.addresses.id(shippingAddressId);
      if (!shippingAddress) {
        throw new ApiError(404, "Shipping address not found");
      }

      let billingAddress = shippingAddress;
      if (billingAddressId && billingAddressId !== shippingAddressId) {
        billingAddress = user.addresses.id(billingAddressId);
        if (!billingAddress) {
          throw new ApiError(404, "Billing address not found");
        }
      }

      if (paymentMethod === "cash_on_delivery") {
        const allowedPincodes = ["712248"];
        if (!allowedPincodes.includes(shippingAddress.postalCode)) {
          throw new ApiError(400, "Cash on delivery is not available for your location");
        }
      }

      let orderItems = [];
      let subtotal = 0;

      for (const cartItem of user.cart.items) {
        const product = cartItem.productId;
        
        if (!product) {
          throw new ApiError(400, "Some products in cart are no longer available");
        }

        if (product.stock < cartItem.quantity) {
          throw new ApiError(400, `Insufficient stock for ${product.name}. Available: ${product.stock}`);
        }

        const discountedPrice = product.discountPercentage > 0 
          ? product.price * (1 - product.discountPercentage / 100)
          : product.price;

        const itemTotal = discountedPrice * cartItem.quantity;
        subtotal += itemTotal;

        orderItems.push({
          product: product._id,
          quantity: cartItem.quantity,
          price: discountedPrice,
        });

        await Product.findByIdAndUpdate(
          product._id,
          { $inc: { stock: -cartItem.quantity } },
          { session }
        );
      }

      // const shipping = subtotal > 1000 ? 0 : 100;
      const shipping = 0;
      // const tax = Math.round(subtotal * 0.18);
      const tax = 0;
      
      let discount = 0;
      if (couponCode) {
        discount = Math.round(subtotal * 0.1);
      }

      const total = subtotal + shipping + tax - discount;
      const orderNumber = `ORD${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      const orderData = {
        user: userId,
        orderNumber,
        items: orderItems,
        shippingAddress: {
          fullName: user.name,
          addressLine1: shippingAddress.street,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country || 'India',
          phone: user.phone || 'N/A',
        },
        paymentInfo: {
          method: paymentMethod,
          status: "pending",
        },
        subtotal,
        tax,
        shipping,
        discount,
        total,
        status: "pending",
        notes: notes || "",
      };
      
      let paymentRequired = false;
      let paymentDetails = {};
      
      if (paymentMethod === "cash_on_delivery") {
        orderData.paymentInfo.status = "pending";
        orderData.paymentInfo.transactionId = `COD_${Date.now()}`;
        orderData.status = "confirmed";
        paymentRequired = false;
      } else {
        paymentRequired = true;
        const options = {
          amount: total * 100,
          currency: "INR",
          receipt: orderNumber,
        };
        
        const razorpayOrder = await razorpay.orders.create(options);
        if (!razorpayOrder) {
          throw new ApiError(500, "Failed to create Razorpay order");
        }

        orderData.paymentInfo.paymentId = razorpayOrder.id;

        paymentDetails = {
          amount: total,
          currency: 'INR',
          method: paymentMethod,
          orderId: razorpayOrder.id,
        };
      }

      const [order] = await Order.create([orderData], { session });

      user.cart.items = [];
      user.cart.updatedAt = new Date();
      await user.save({ session });

      for (const item of orderItems) {
        await UserActivity.logActivity({
          userId,
          productId: item.product,
          activityType: "purchase",
          metadata: {
            orderId: order._id,
            quantity: item.quantity,
            price: item.price,
          },
        });
      }

      if (paymentRequired) {
        return res.status(201).json(
          new ApiResponse(
            201,
            { order, paymentRequired, paymentDetails },
            "Order created successfully. Complete payment to confirm."
          )
        );
      } else {
        return res.status(201).json(
          new ApiResponse(201, { order, paymentRequired: false }, "Order placed successfully with Cash on Delivery")
        );
      }
    });
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }
});

// --- The broken verifyPayment placeholder has been REMOVED from this file ---

const getUserOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    startDate,
    endDate
  } = req.query;

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = { user: req.user._id };

  if (status) {
    filter.status = status;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endOfDay;
    }
  }

  const totalOrders = await Order.countDocuments(filter);

  const orders = await Order.find(filter)
    .populate("items.product", "name images price")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber)
    .lean();

  const enrichedOrders = orders.map(order => ({
    ...order,
    canBeCancelled: ["pending", "confirmed"].includes(order.status),
    canBeReturned: order.status === "delivered",
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    deliveryDate: getEstimatedDelivery(order.createdAt, order.shippingAddress.postalCode)
  }));

  const pagination = {
    total: totalOrders,
    page: pageNumber,
    limit: limitNumber,
    pages: Math.ceil(totalOrders / limitNumber),
    hasNext: pageNumber < Math.ceil(totalOrders / limitNumber),
    hasPrev: pageNumber > 1
  };

  return res.status(200).json(
    new ApiResponse(200, { orders: enrichedOrders, pagination }, "Orders retrieved successfully")
  );
});

const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const order = await Order.findOne({
    _id: id,
    user: req.user._id
  })
    .populate("items.product", "name description images price")
    .lean();

  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  
  const enrichedOrder = {
    ...order,
    canBeCancelled: ["pending", "confirmed"].includes(order.status),
    canBeReturned: order.status === "delivered",
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    deliveryDate: getEstimatedDelivery(order.createdAt, order.shippingAddress.postalCode),
    timeline: getOrderTimeline(order)
  };

  return res.status(200).json(
    new ApiResponse(200, enrichedOrder, "Order retrieved successfully")
  );
});

const cancelOrder = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      const { reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid order ID");
      }

      const order = await Order.findOne({
        _id: id,
        user: req.user._id
      }).session(session);

      if (!order) {
        throw new ApiError(404, "Order not found");
      }

      if (!["pending", "confirmed"].includes(order.status)) {
        throw new ApiError(400, `Cannot cancel order in ${order.status} status`);
      }

      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }

      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = reason || "Cancelled by customer";
      await order.save({ session });

      return res.status(200).json(
        new ApiResponse(200, { orderId: order._id, status: order.status }, "Order cancelled successfully")
      );
    });
  } finally {
    await session.endSession();
  }
});

const getOrderTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const order = await Order.findOne({
    _id: id,
    user: req.user._id
  })
    .select("status orderNumber createdAt updatedAt shippingAddress trackingNumber")
    .lean();

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const trackingInfo = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    trackingNumber: order.trackingNumber,
    estimatedDelivery: getEstimatedDelivery(order.createdAt, order.shippingAddress.postalCode),
    timeline: getOrderTimeline(order),
    shippingAddress: order.shippingAddress
  };

  return res.status(200).json(
    new ApiResponse(200, trackingInfo, "Order tracking information retrieved successfully")
  );
});

function getEstimatedDelivery(orderDate, postalCode) {
  const deliveryDays = postalCode === "712248" ? 2 : 5;
  const estimatedDate = new Date(orderDate);
  estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
  return estimatedDate;
}

function getOrderTimeline(order) {
  const timeline = [
    { status: "pending", label: "Order Placed", timestamp: order.createdAt, completed: true }
  ];
  if (["confirmed", "processing", "shipped", "delivered"].includes(order.status)) {
    timeline.push({ status: "confirmed", label: "Order Confirmed", timestamp: order.updatedAt, completed: true });
  }
  if (["processing", "shipped", "delivered"].includes(order.status)) {
    timeline.push({ status: "processing", label: "Order Processing", timestamp: order.updatedAt, completed: true });
  }
  if (["shipped", "delivered"].includes(order.status)) {
    timeline.push({ status: "shipped", label: "Order Shipped", timestamp: order.updatedAt, completed: true });
  }
  if (order.status === "delivered") {
    timeline.push({ status: "delivered", label: "Order Delivered", timestamp: order.updatedAt, completed: true });
  }
  if (order.status === "cancelled") {
    timeline.push({ status: "cancelled", label: "Order Cancelled", timestamp: order.cancelledAt || order.updatedAt, completed: true });
  }
  return timeline;
}

export {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getOrderTracking
};
