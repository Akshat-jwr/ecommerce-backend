import { Router } from "express";
import { 
    registerUser, 
    verifyEmail, 
    resendOTP, 
    loginUser, 
    googleAuth,
    logoutUser
} from "../controllers/auth.controller.js";
import { verifyJWT, refreshAccessToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.post("/register", registerUser);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOTP);
router.post("/login", loginUser);
router.post("/google", googleAuth);
router.post("/refresh-token", refreshAccessToken);

// Protected routes
router.post("/logout", verifyJWT, logoutUser);

export default router; 