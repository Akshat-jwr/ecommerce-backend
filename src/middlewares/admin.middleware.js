import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import logger from "../utils/logger.js";

/**
 * Middleware to check if the authenticated user has admin role
 * This should be used after verifyJWT middleware to ensure user is authenticated
 */
export const verifyAdmin = asyncHandler(async (req, res, next) => {
    // req.user should be set by the verifyJWT middleware
    if (!req.user) {
        logger.security("ADMIN_ACCESS_ATTEMPT", "Admin access attempt without authentication", {
            ip: req.ip,
            url: req.originalUrl
        });
        throw new ApiError(401, "Unauthorized request. Authentication required");
    }

    // Debug log current user info
    logger.info("Admin verification attempt", {
        userId: req.user._id,
        role: req.user.role,
        url: req.originalUrl
    });

    // For added security and to ensure role is current, we re-fetch the user
    // But we don't use lean() as it might cause issues
    const user = await User.findById(req.user?._id);

    if (!user) {
        logger.security("ADMIN_ACCESS_ATTEMPT", "Admin access with invalid user", {
            userId: req.user._id,
            url: req.originalUrl
        });
        throw new ApiError(401, "Invalid user");
    }

    // Check if user has admin role
    if (user.role !== "admin") {
        logger.security("UNAUTHORIZED_ADMIN_ACCESS", "Non-admin user attempted admin access", {
            userId: user._id,
            role: user.role,
            url: req.originalUrl
        });
        throw new ApiError(403, "Forbidden: Admin access required");
    }

    // Successfully verified admin, proceed to next middleware
    logger.info("Admin verification successful", {
        userId: user._id,
        url: req.originalUrl
    });

    next();
}); 