import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

/**
 * Middleware to check if the authenticated user has admin role
 * This should be used after verifyJWT middleware to ensure user is authenticated
 */
export const verifyAdmin = asyncHandler(async (req, res, next) => {
    // req.user should be set by the verifyJWT middleware
    if (!req.user) {
        throw new ApiError(401, "Unauthorized request. Authentication required");
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(401, "Invalid user");
    }

    // Check if user has admin role
    if (user.role !== "admin") {
        throw new ApiError(403, "Forbidden: Admin access required");
    }

    next();
}); 