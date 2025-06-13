import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyPayment } from "../controllers/user/order.controller.js";
import { handleRazorpayWebhook } from "../controllers/webhooks/payment.controller.js";
import { PaymentService } from "../services/paymentService.js";
import { body } from "express-validator";
import { validate } from "../middlewares/validator.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const router = Router();

/**
 * @swagger
 * /api/v1/payment/verify:
 *   post:
 *     summary: Verify Razorpay payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *             properties:
 *               orderId:
 *                 type: string
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified successfully
 */
router.post("/verify", 
  verifyJWT,
  body("orderId").isMongoId().withMessage("Invalid order ID"),
  body("razorpay_order_id").notEmpty().withMessage("Razorpay order ID required"),
  body("razorpay_payment_id").notEmpty().withMessage("Razorpay payment ID required"),
  body("razorpay_signature").notEmpty().withMessage("Razorpay signature required"),
  validate,
  verifyPayment
);

/**
 * @swagger
 * /api/v1/payment/methods:
 *   post:
 *     summary: Get available payment methods for location
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postalCode
 *             properties:
 *               postalCode:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *     responses:
 *       200:
 *         description: Available payment methods retrieved
 */
router.post("/methods",
  verifyJWT,
  body("postalCode").notEmpty().withMessage("Postal code is required"),
  validate,
  asyncHandler(async (req, res) => {
    const { postalCode, city, state } = req.body;
    
    const shippingAddress = { postalCode, city, state };
    const paymentMethods = await PaymentService.getAvailablePaymentMethods(shippingAddress);
    
    return res.status(200).json(
      new ApiResponse(200, paymentMethods, "Payment methods retrieved successfully")
    );
  })
);

/**
 * @swagger
 * /api/v1/payment/status/{paymentId}:
 *   get:
 *     summary: Get payment status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment status retrieved
 */
router.get("/status/:paymentId",
  verifyJWT,
  asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    
    const paymentStatus = await PaymentService.getPaymentStatus(paymentId);
    
    return res.status(200).json(
      new ApiResponse(200, paymentStatus, "Payment status retrieved successfully")
    );
  })
);

/**
 * Webhook endpoint for Razorpay
 * No authentication required as it's called by Razorpay
 */
router.post("/webhook/razorpay", handleRazorpayWebhook);

export default router;
