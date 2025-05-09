import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

// Import secure cookie config
import { secureCookieConfig } from "./security.middleware.js";
import logger from "../utils/logger.js";

/**
 * Verify user is authenticated with enhanced security
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        // Get token from cookies or authorization header
        const token = req.cookies?.accessToken || 
            req.header("Authorization")?.replace("Bearer ", "");
        
        if (!token) {
            logger.security("AUTH_FAILURE", "No token provided", { 
                url: req.originalUrl, 
                ip: req.ip 
            });
            throw new ApiError(401, "Unauthorized request");
        }
        
        // Log token for debugging
        logger.info("Token verification attempt", { 
            url: req.originalUrl,
            tokenExists: !!token
        });
        
        // Verify the token with more options
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
            algorithms: ["HS256"], // Explicitly specify algorithm
            ignoreExpiration: false, // Ensure expired tokens are rejected
        });
        
        // Find the user with minimal projection - don't use lean() for now as it might cause issues
        const user = await User.findById(decodedToken?._id)
            .select("-password -refreshToken");
        
        if (!user) {
            logger.security("AUTH_FAILURE", "Invalid user from token", { 
                url: req.originalUrl, 
                tokenId: decodedToken?._id 
            });
            throw new ApiError(401, "Invalid access token");
        }
        
        // Check if user is active - removed temporarily for debugging
        // if (!user.isActive) {
        //     throw new ApiError(403, "Account is suspended. Please contact support.");
        // }
        
        // Add user to request object
        req.user = user;
        
        // Add token data for potential forensics/debugging
        req.tokenData = {
            iat: decodedToken.iat,
            exp: decodedToken.exp,
            id: decodedToken._id
        };
        
        // Log successful auth
        logger.info("Authentication successful", { 
            userId: user._id,
            role: user.role,
            url: req.originalUrl
        });
        
        next();
        
    } catch (error) {
        // More specific error messages based on JWT error types
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Access token has expired");
        } else if (error.name === "JsonWebTokenError") {
            throw new ApiError(401, "Invalid token format");
        } else {
            throw new ApiError(401, error?.message || "Invalid access token");
        }
    }
});

/**
 * Verify user has admin role
 */
export const isAdmin = asyncHandler(async (req, res, next) => {
    // Log the user object to debug
    logger.info("Admin check", { 
        user: req.user,
        role: req.user?.role
    });

    if (req.user?.role !== "admin") {
        logger.security("UNAUTHORIZED_ACCESS", "Non-admin tried to access admin route", {
            userId: req.user?._id,
            role: req.user?.role,
            url: req.originalUrl
        });
        throw new ApiError(403, "Admin access required");
    }
    next();
});

/**
 * Refresh access token using refresh token with enhanced security
 */
export const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        // Get refresh token from cookies or request body
        const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
        
        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request");
        }
        
        // Verify the refresh token with more options
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET, {
            algorithms: ["HS256"],
            ignoreExpiration: false,
        });
        
        // Find the user
        const user = await User.findById(decodedToken?._id);
        
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }
        
        // Check if user is active
        if (!user.isActive) {
            throw new ApiError(403, "Account is suspended. Please contact support.");
        }
        
        // Check if incoming refresh token matches the stored one
        if (incomingRefreshToken !== user?.refreshToken) {
            // This could indicate token theft - invalidate all tokens
            user.refreshToken = null;
            await user.save({ validateBeforeSave: false });
            
            throw new ApiError(401, "Refresh token is expired or used - please login again");
        }
        
        // Generate new tokens
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        
        // Update refresh token
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        
        // Set cookies with enhanced security
        return res
            .status(200)
            .cookie("accessToken", accessToken, secureCookieConfig)
            .cookie("refreshToken", refreshToken, {
                ...secureCookieConfig,
                // Give refresh token a longer expiry
                maxAge: process.env.REFRESH_TOKEN_EXPIRY 
                    ? parseInt(process.env.REFRESH_TOKEN_EXPIRY) * 1000 
                    : 180 * 24 * 60 * 60 * 1000 // 180 days default
            })
            .json({
                statusCode: 200,
                data: { accessToken, refreshToken },
                message: "Access token refreshed"
            });
        
    } catch (error) {
        // More specific error messages
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Refresh token has expired, please login again");
        } else if (error.name === "JsonWebTokenError") {
            throw new ApiError(401, "Invalid token format");
        } else {
            throw new ApiError(401, error?.message || "Invalid refresh token");
        }
    }
}); 