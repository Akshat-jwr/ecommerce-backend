import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import logger from '../utils/logger.js';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export class PaymentService {
  /**
   * Create Razorpay Order for checkout
   */
  static async createRazorpayOrder(orderData) {
    try {
      const { amount, orderId, currency = 'INR', customerInfo } = orderData;
      
      const options = {
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt: orderId,
        payment_capture: 1, // Auto capture payments
        notes: {
          order_id: orderId,
          created_at: new Date().toISOString(),
          customer_id: customerInfo?.userId || 'guest'
        }
      };

      const razorpayOrder = await razorpay.orders.create(options);

      logger.info(`Razorpay order created: ${razorpayOrder.id} for amount: ₹${amount}`);

      return {
        success: true,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
        orderDetails: razorpayOrder
      };
    } catch (error) {
      logger.error('Razorpay order creation failed:', error);
      return {
        success: false,
        error: error.message || 'Payment gateway error'
      };
    }
  }

  /**
   * Verify Razorpay Payment Signature
   */
  static async verifyPaymentSignature(paymentData) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      } = paymentData;

      // Create signature verification string
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      
      // Generate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      // Verify signature
      if (expectedSignature !== razorpay_signature) {
        throw new Error('Invalid payment signature');
      }

      // Fetch payment details from Razorpay
      const payment = await razorpay.payments.fetch(razorpay_payment_id);

      logger.info(`Payment verified: ${razorpay_payment_id} for order: ${razorpay_order_id}`);

      return {
        success: true,
        verified: true,
        transactionId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: payment.amount / 100, // Convert from paise
        method: payment.method,
        status: payment.status,
        paymentDetails: payment
      };
    } catch (error) {
      logger.error('Payment verification failed:', error);
      return {
        success: false,
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Process UPI Payment
   */
  static async processUPIPayment(paymentData) {
    try {
      const { upiId, amount, orderId, customerInfo } = paymentData;
      
      // Validate UPI ID format
      if (!upiId || !upiId.includes('@')) {
        throw new Error("Invalid UPI ID format");
      }

      // Create Razorpay order for UPI
      const orderResult = await this.createRazorpayOrder({
        amount,
        orderId,
        currency: 'INR',
        customerInfo
      });

      if (!orderResult.success) {
        throw new Error(orderResult.error);
      }

      return {
        success: true,
        razorpayOrderId: orderResult.razorpayOrderId,
        amount,
        upiId,
        key: process.env.RAZORPAY_KEY_ID,
        method: 'upi',
        status: 'pending',
        orderDetails: orderResult.orderDetails
      };
    } catch (error) {
      logger.error('UPI payment processing failed:', error);
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Process Card Payment
   */
  static async processCardPayment(paymentData) {
    try {
      const { amount, orderId, customerInfo } = paymentData;
      
      // Create Razorpay order for card payment
      const orderResult = await this.createRazorpayOrder({
        amount,
        orderId,
        currency: 'INR',
        customerInfo
      });

      if (!orderResult.success) {
        throw new Error(orderResult.error);
      }

      return {
        success: true,
        razorpayOrderId: orderResult.razorpayOrderId,
        amount,
        key: process.env.RAZORPAY_KEY_ID,
        method: 'card',
        status: 'pending',
        orderDetails: orderResult.orderDetails
      };
    } catch (error) {
      logger.error('Card payment processing failed:', error);
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Initiate Refund
   */
  static async initiateRefund(paymentId, amount, reason = 'Customer request') {
    try {
      const refund = await razorpay.payments.refund(paymentId, {
        amount: Math.round(amount * 100), // Convert to paise
        speed: 'normal',
        notes: {
          reason,
          refund_date: new Date().toISOString()
        },
        receipt: `refund_${Date.now()}`
      });

      logger.info(`Refund initiated: ${refund.id} for payment: ${paymentId} amount: ₹${amount}`);

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        refundDetails: refund
      };
    } catch (error) {
      logger.error('Refund initiation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate COD availability
   */
  static async validateCOD(shippingAddress) {
    // Add your COD validation logic here
    const allowedPincodes = ["712248", "700001", "110001"]; // Add more pincodes
    return allowedPincodes.includes(shippingAddress.postalCode);
  }

  /**
   * Get payment methods available for location
   */
  static async getAvailablePaymentMethods(shippingAddress) {
    const methods = [
      {
        id: 'upi',
        name: 'UPI',
        description: 'Pay using UPI apps like PhonePe, GPay, Paytm',
        icon: '💳',
        enabled: true
      },
      {
        id: 'card',
        name: 'Credit/Debit Card',
        description: 'Visa, Mastercard, RuPay, American Express',
        icon: '💳',
        enabled: true
      },
      {
        id: 'netbanking',
        name: 'Net Banking',
        description: 'Pay using your bank account',
        icon: '🏦',
        enabled: true
      },
      {
        id: 'wallet',
        name: 'Wallets',
        description: 'Paytm, PhonePe, Amazon Pay, etc.',
        icon: '👛',
        enabled: true
      }
    ];
    
    // Add COD if available for the location
    if (await this.validateCOD(shippingAddress)) {
      methods.push({
        id: 'cod',
        name: 'Cash on Delivery',
        description: 'Pay when you receive the order',
        icon: '💵',
        enabled: true,
        note: 'Available for your location'
      });
    }

    return methods;
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(paymentId) {
    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return {
        success: true,
        status: payment.status,
        amount: payment.amount / 100,
        method: payment.method,
        details: payment
      };
    } catch (error) {
      logger.error('Error fetching payment status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Capture payment (for authorized payments)
   */
  static async capturePayment(paymentId, amount) {
    try {
      const payment = await razorpay.payments.capture(paymentId, Math.round(amount * 100));
      
      logger.info(`Payment captured: ${paymentId} amount: ₹${amount}`);
      
      return {
        success: true,
        paymentId: payment.id,
        amount: payment.amount / 100,
        status: payment.status
      };
    } catch (error) {
      logger.error('Payment capture failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
