import crypto from 'crypto';
import { Order } from '../../models/order.model.js';
import { Product } from '../../models/product.model.js';
import { PaymentService } from '../../services/paymentService.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/logger.js';

/**
 * Handle Razorpay webhooks
 */
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const webhookSignature = req.headers['x-razorpay-signature'];
  const webhookBody = JSON.stringify(req.body);

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(webhookBody)
    .digest('hex');

  if (webhookSignature !== expectedSignature) {
    logger.error('Invalid webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

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

/**
 * Handle successful payment capture
 */
async function handlePaymentCaptured(payment) {
  try {
    const order = await Order.findOne({
      'paymentInfo.gatewayOrderId': payment.order_id
    });

    if (!order) {
      logger.error(`Order not found for payment: ${payment.id}`);
      return;
    }

    if (order.paymentInfo.status === 'completed') {
      logger.info(`Payment already processed for order: ${order._id}`);
      return;
    }

    // Update order payment status
    order.paymentInfo.status = 'completed';
    order.paymentInfo.transactionId = payment.id;
    order.paymentInfo.paymentId = payment.id;
    order.paymentInfo.verifiedAt = new Date();
    order.status = 'confirmed';
    
    await order.save();

    logger.info(`Payment captured for order: ${order._id}, amount: ₹${payment.amount / 100}`);
    
    // Send confirmation email/SMS (implement as needed)
    // await notificationService.sendOrderConfirmation(order);
    
  } catch (error) {
    logger.error('Error handling payment captured:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(payment) {
  try {
    const order = await Order.findOne({
      'paymentInfo.gatewayOrderId': payment.order_id
    });

    if (!order) {
      logger.error(`Order not found for failed payment: ${payment.id}`);
      return;
    }

    // Update order status
    order.paymentInfo.status = 'failed';
    order.paymentInfo.failureReason = payment.error_description || 'Payment failed';
    order.status = 'cancelled';
    
    await order.save();

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    }

    logger.info(`Payment failed for order: ${order._id}, restoring stock`);
    
  } catch (error) {
    logger.error('Error handling payment failed:', error);
  }
}

/**
 * Handle refund processed
 */
async function handleRefundProcessed(refund) {
  try {
    const order = await Order.findOne({
      'paymentInfo.transactionId': refund.payment_id
    });

    if (!order) {
      logger.error(`Order not found for refund: ${refund.id}`);
      return;
    }

    // Update order refund status
    order.paymentInfo.refundId = refund.id;
    order.paymentInfo.refundStatus = 'completed';
    order.paymentInfo.refundAmount = refund.amount / 100;
    order.status = 'refunded';
    
    await order.save();

    logger.info(`Refund processed for order: ${order._id}, amount: ₹${refund.amount / 100}`);
    
  } catch (error) {
    logger.error('Error handling refund processed:', error);
  }
}

/**
 * Handle refund failed
 */
async function handleRefundFailed(refund) {
  try {
    const order = await Order.findOne({
      'paymentInfo.transactionId': refund.payment_id
    });

    if (!order) {
      logger.error(`Order not found for failed refund: ${refund.id}`);
      return;
    }

    // Update refund status
    order.paymentInfo.refundStatus = 'failed';
    order.paymentInfo.refundFailureReason = refund.error_description || 'Refund failed';
    
    await order.save();

    logger.error(`Refund failed for order: ${order._id}, reason: ${refund.error_description}`);
    
  } catch (error) {
    logger.error('Error handling refund failed:', error);
  }
}
