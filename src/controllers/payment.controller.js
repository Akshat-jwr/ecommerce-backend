import crypto from 'crypto';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

/**
 * Verifies a Razorpay payment from the client-side callback.
 * This is the primary method for confirming an order.
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Payment verification details are missing");
  }

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  const isAuthentic = expectedSignature === razorpay_signature;

  if (!isAuthentic) {
    await Order.findByIdAndUpdate(orderId, {
      'paymentInfo.status': 'failed',
      'paymentInfo.failureReason': 'Signature mismatch',
      status: 'failed'
    });
    throw new ApiError(400, "Invalid payment signature. Payment verification failed.");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Update order with payment details
  order.paymentInfo.status = 'completed';
  order.paymentInfo.transactionId = razorpay_payment_id; // Set the transaction ID
  order.status = 'confirmed'; // Move order to 'confirmed' status
  
  await order.save({ validateBeforeSave: false });

  logger.info(`Payment verified and order confirmed for Order ID: ${order._id}`);

  return res.status(200).json(
    new ApiResponse(200, { orderId: order._id, status: 'success' }, "Payment verified successfully")
  );
});


/**
 * Handles Razorpay webhooks as a secondary confirmation mechanism.
 */
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  // As requested, the webhook signature verification is disabled.
  // In production, this should be enabled for security.
  /*
  const webhookSignature = req.headers['x-razorpay-signature'];
  const webhookBody = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(webhookBody)
    .digest('hex');

  if (webhookSignature !== expectedSignature) {
    logger.error('Invalid webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }
  */

  const event = req.body;
  logger.info(`Razorpay webhook received: ${event.event}`, {
    event: event.event,
    entityId: event.payload?.payment?.entity?.id || event.payload?.order?.entity?.id
  });

  try {
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      case 'refund.processed':
        await handleRefundProcessed(event.payload.refund.entity);
        break;
      case 'refund.failed':
        await handleRefundFailed(event.payload.refund.entity);
        break;
      default:
        logger.info(`Unhandled webhook event: ${event.event}`);
    }

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handlePaymentCaptured(payment) {
  try {
    const order = await Order.findOne({ 'paymentInfo.paymentId': payment.order_id });

    if (!order) {
      logger.error(`Webhook: Order not found for payment: ${payment.id}`);
      return;
    }

    if (order.paymentInfo.status === 'completed') {
      logger.info(`Webhook: Payment already processed for order: ${order._id}`);
      return;
    }

    order.paymentInfo.status = 'completed';
    order.paymentInfo.transactionId = payment.id;
    order.status = 'confirmed';
    await order.save();
    logger.info(`Webhook: Payment captured for order: ${order._id}`);
    
  } catch (error) {
    logger.error('Webhook: Error handling payment captured:', error);
  }
}

async function handlePaymentFailed(payment) {
  try {
    const order = await Order.findOne({ 'paymentInfo.paymentId': payment.order_id });

    if (!order) {
      logger.error(`Webhook: Order not found for failed payment: ${payment.id}`);
      return;
    }

    if (order.status === 'failed') return; // Already handled

    order.paymentInfo.status = 'failed';
    order.paymentInfo.failureReason = payment.error_description || 'Payment failed';
    order.status = 'failed';
    await order.save();

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }
    logger.info(`Webhook: Payment failed for order: ${order._id}, restoring stock`);
    
  } catch (error) {
    logger.error('Webhook: Error handling payment failed:', error);
  }
}

async function handleRefundProcessed(refund) {
  try {
    const order = await Order.findOne({ 'paymentInfo.transactionId': refund.payment_id });
    if (!order) {
      logger.error(`Order not found for refund: ${refund.id}`);
      return;
    }
    order.status = 'refunded';
    await order.save();
    logger.info(`Refund processed for order: ${order._id}, amount: ₹${refund.amount / 100}`);
  } catch (error) {
    logger.error('Error handling refund processed:', error);
  }
}

async function handleRefundFailed(refund) {
  try {
    logger.error(`Refund failed for paymentId: ${refund.payment_id}, reason: ${refund.error_description}`);
  } catch (error) {
    logger.error('Error handling refund failed:', error);
  }
}
