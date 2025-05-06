import { UserActivity } from "../models/userActivity.model.js";
import UAParser from "ua-parser-js";

/**
 * Extract basic context information from the request
 * @param {Object} req - Express request object
 * @returns {Object} - Context information
 */
const extractContextFromRequest = (req) => {
    // Parse user agent
    const parser = new UAParser(req.headers["user-agent"]);
    const ua = parser.getResult();
    
    return {
        device: `${ua.device.vendor || ""} ${ua.device.model || ""} ${ua.device.type || "desktop"}`.trim(),
        platform: `${ua.os.name || ""} ${ua.os.version || ""}`.trim(),
        referrer: req.headers.referer || "",
        location: req.ip
    };
};

/**
 * Track product view activity
 */
export const trackProductView = async (req, res, next) => {
    // Continue with the request immediately
    next();
    
    try {
        // Only track for authenticated users
        if (!req.user?._id) return;
        
        const productId = req.params.productId || req.params.id;
        if (!productId) return;
        
        const context = extractContextFromRequest(req);
        
        // Log activity asynchronously (don't await)
        UserActivity.logActivity({
            userId: req.user._id,
            productId,
            activityType: "view",
            metadata: {
                clickSource: req.headers.referer || req.query.source || "direct",
            },
            context
        });
    } catch (error) {
        // Don't block the request flow for tracking errors
        console.error("Error tracking product view:", error);
    }
};

/**
 * Track search activity
 */
export const trackSearch = async (req, res, next) => {
    // Continue with the request immediately
    next();
    
    try {
        // Track for all users (even anonymous)
        const userId = req.user?._id || "anonymous";
        const searchQuery = req.query.q || req.query.query || req.query.search;
        
        if (!searchQuery) return;
        
        const context = extractContextFromRequest(req);
        
        // Only log for authenticated users
        if (userId !== "anonymous") {
            // Log activity asynchronously (don't await)
            UserActivity.logActivity({
                userId,
                productId: "search", // Special case for search
                activityType: "search",
                metadata: {
                    searchQuery,
                    resultCount: res.locals.resultCount || 0
                },
                context
            });
        }
    } catch (error) {
        // Don't block the request flow for tracking errors
        console.error("Error tracking search:", error);
    }
};

/**
 * Track cart/wishlist modifications
 * @param {string} activityType - Type of activity (cart_add, cart_remove, etc.)
 */
export const createActivityTracker = (activityType) => {
    return async (req, res, next) => {
        // Process the original request first
        next();
        
        try {
            // Only track for authenticated users
            if (!req.user?._id) return;
            
            const productId = req.params.productId || req.body.productId;
            if (!productId) return;
            
            const context = extractContextFromRequest(req);
            
            // Include quantity if available
            const metadata = {};
            if (req.body.quantity) {
                metadata.purchaseQuantity = req.body.quantity;
            }
            
            // Log activity asynchronously
            UserActivity.logActivity({
                userId: req.user._id,
                productId,
                activityType,
                metadata,
                context
            });
        } catch (error) {
            // Don't block the request flow for tracking errors
            console.error(`Error tracking ${activityType}:`, error);
        }
    };
};

// Create pre-configured trackers for common activities
export const trackCartAdd = createActivityTracker("cart_add");
export const trackCartRemove = createActivityTracker("cart_remove");
export const trackWishlistAdd = createActivityTracker("wishlist_add");
export const trackWishlistRemove = createActivityTracker("wishlist_remove");
export const trackPurchase = createActivityTracker("purchase"); 