import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Verify user is authenticated
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        // Get token from cookies or authorization header
        const token = req.cookies?.accessToken || 
            req.header("Authorization")?.replace("Bearer ", "");
        
        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }
        
        // Verify the token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        
        // Find the user
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
        
        if (!user) {
            throw new ApiError(401, "Invalid access token");
        }
        
        // Add user to request object
        req.user = user;
        next();
        
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});

/**
 * Verify user has admin role
 */
export const isAdmin = asyncHandler(async (req, res, next) => {
    if (req.user?.role !== "admin") {
        throw new ApiError(403, "Admin access required");
    }
    next();
}); 