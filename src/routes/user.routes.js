import { Router } from "express";
import { verifyJWT, isAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
// router.post("/register", registerUser);
// router.post("/login", loginUser);
// router.post("/refresh-token", refreshAccessToken);

// Protected routes
// router.use(verifyJWT); // All routes below this will require authentication
// router.get("/logout", logoutUser);
// router.get("/profile", getCurrentUser);
// router.patch("/profile", updateUserProfile);
// router.patch("/change-password", changeCurrentPassword);

// Admin routes
// router.use(isAdmin); // All routes below this will require admin role
// router.get("/", getAllUsers);
// router.get("/:userId", getUserById);
// router.delete("/:userId", deleteUser);
// router.patch("/:userId/role", updateUserRole);

export default router; 