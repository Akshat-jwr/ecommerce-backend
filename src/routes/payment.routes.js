import { Router } from "express";
import { 
    verifyPayment, 
    handleRazorpayWebhook 
} from "../controllers/payment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/verify").post(verifyJWT, verifyPayment);
router.route("/webhook").post(handleRazorpayWebhook);

export default router;