import { UserActivity } from "../models/userActivity.model.js";
import { UserBehavior } from "../models/userBehavior.model.js";
import { UAParser } from "ua-parser-js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Extract enhanced context information from the request
 */
const extractContextFromRequest = (req) => {
  const parser = new UAParser(req.headers["user-agent"]);
  const ua = parser.getResult();

  return {
    device: `${ua.device.vendor || ""} ${ua.device.model || ""} ${ua.device.type || "desktop"}`.trim(),
    platform: `${ua.os.name || ""} ${ua.os.version || ""}`.trim(),
    browser: `${ua.browser.name || ""} ${ua.browser.version || ""}`.trim(),
    referrer: req.headers.referer || "",
    location: req.ip,
    sessionId: req.sessionID || req.headers["x-session-id"] || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    userAgent: req.headers["user-agent"] || "",
    ipAddress: req.ip
  };
};

/**
 * Track search behavior with enhanced data
 */
export const trackSearch = asyncHandler(async (req, res, next) => {
  next();

  try {
    const userId = req.user?._id;
    const searchQuery = req.query.q || req.query.query || req.query.search;
    
    if (!searchQuery) return;

    const context = extractContextFromRequest(req);

    // Store search behavior in UserBehavior if user is authenticated
    if (userId) {
      await UserBehavior.create({
        userId,
        sessionId: context.sessionId,
        interactionType: "search",
        searchQuery,
        searchFilters: {
          category: req.query.category,
          minPrice: req.query.minPrice,
          maxPrice: req.query.maxPrice,
          sort: req.query.sort
        },
        context,
        timestamp: new Date()
      }).catch(err => {
        console.error("Error storing UserBehavior for search:", err.message);
      });
    }

    // Log activity with proper data structure
    await UserActivity.logActivity({
      userId: userId, // Will be handled properly in the model
      activityType: "search",
      metadata: {
        searchQuery,
        resultCount: res.locals.resultCount || 0,
        filters: {
          category: req.query.category,
          minPrice: req.query.minPrice,
          maxPrice: req.query.maxPrice,
          sort: req.query.sort
        }
      },
      context,
      anonymousId: context.sessionId
    });

  } catch (error) {
    console.error("Error tracking search:", error.message);
  }
});

/**
 * Track product view for public routes
 */
export const trackProductView = asyncHandler(async (req, res, next) => {
  next();

  try {
    const productId = req.params.productId || req.params.id;
    if (!productId) return;

    const context = extractContextFromRequest(req);
    const userId = req.user?._id;

    // Store view data in UserBehavior if user is authenticated
    if (userId) {
      await UserBehavior.create({
        userId,
        productId,
        sessionId: context.sessionId,
        interactionType: "product_view",
        source: req.headers.referer || req.query.source || "direct",
        context,
        timestamp: new Date()
      }).catch(err => {
        console.error("Error storing UserBehavior for product view:", err.message);
      });
    }

    // Log activity
    await UserActivity.logActivity({
      userId: userId,
      productId: productId,
      activityType: "view",
      metadata: {
        clickSource: req.headers.referer || req.query.source || "direct",
        timeSpent: 0 // Will be updated later if tracking is implemented
      },
      context,
      anonymousId: context.sessionId
    });

  } catch (error) {
    console.error("Error tracking product view:", error.message);
  }
});

/**
 * Track cart interactions with detailed data
 */
export const trackCartAdd = asyncHandler(async (req, res, next) => {
  next();

  try {
    if (!req.user?._id) return;

    const productId = req.body.productId;
    const quantity = req.body.quantity || 1;
    const context = extractContextFromRequest(req);

    // Store in UserBehavior
    await UserBehavior.create({
      userId: req.user._id,
      productId,
      sessionId: context.sessionId,
      interactionType: "cart_add",
      quantity,
      context,
      timestamp: new Date()
    }).catch(err => {
      console.error("Error storing UserBehavior for cart add:", err.message);
    });

    // Log activity
    await UserActivity.logActivity({
      userId: req.user._id,
      productId,
      activityType: "cart_add",
      metadata: { quantity },
      context
    });

  } catch (error) {
    console.error("Error tracking cart add:", error.message);
  }
});

/**
 * Track wishlist interactions
 */
export const trackWishlistAdd = asyncHandler(async (req, res, next) => {
  next();

  try {
    if (!req.user?._id) return;

    const productId = req.body.productId;
    const context = extractContextFromRequest(req);

    // Store in UserBehavior
    await UserBehavior.create({
      userId: req.user._id,
      productId,
      sessionId: context.sessionId,
      interactionType: "wishlist_add",
      context,
      timestamp: new Date()
    }).catch(err => {
      console.error("Error storing UserBehavior for wishlist add:", err.message);
    });

    // Log activity
    await UserActivity.logActivity({
      userId: req.user._id,
      productId,
      activityType: "wishlist_add",
      metadata: {},
      context
    });

  } catch (error) {
    console.error("Error tracking wishlist add:", error.message);
  }
});

/**
 * Track detailed product interaction
 */
export const trackProductInteraction = asyncHandler(async (req, res, next) => {
  next();
  
  try {
    if (!req.user?._id) return;

    const productId = req.params.productId || req.params.id;
    const { 
      timeSpent = 0, 
      scrollDepth = 0, 
      imageInteractions = [], 
      source = "direct",
      priceChecked = false,
      reviewsViewed = false,
      specificationsViewed = false,
      addToCartClicked = false,
      addToWishlistClicked = false
    } = req.body;

    if (!productId) return;

    const context = extractContextFromRequest(req);

    // Store detailed behavior data
    await UserBehavior.create({
      userId: req.user._id,
      productId,
      sessionId: context.sessionId,
      interactionType: "product_view",
      timeSpent,
      scrollDepth,
      imageInteractions,
      source,
      actions: {
        priceChecked,
        reviewsViewed,
        specificationsViewed,
        addToCartClicked,
        addToWishlistClicked
      },
      context,
      timestamp: new Date()
    }).catch(err => {
      console.error("Error storing UserBehavior for product interaction:", err.message);
    });

    // Also log simplified activity
    await UserActivity.logActivity({
      userId: req.user._id,
      productId,
      activityType: "view",
      metadata: {
        timeSpent,
        scrollDepth,
        source,
        engagementScore: calculateEngagementScore({
          timeSpent,
          scrollDepth,
          imageInteractions: imageInteractions.length,
          actions: { priceChecked, reviewsViewed, specificationsViewed }
        })
      },
      context
    });

  } catch (error) {
    console.error("Error tracking product interaction:", error.message);
  }
});

/**
 * Track page time and engagement
 */
export const trackPageTime = asyncHandler(async (req, res, next) => {
  next();

  try {
    if (!req.user?._id) return;

    const { pageType, timeSpent, interactions } = req.body;
    const context = extractContextFromRequest(req);

    await UserBehavior.create({
      userId: req.user._id,
      sessionId: context.sessionId,
      interactionType: "page_engagement",
      pageType,
      timeSpent,
      interactions,
      context,
      timestamp: new Date()
    }).catch(err => {
      console.error("Error storing UserBehavior for page time:", err.message);
    });

  } catch (error) {
    console.error("Error tracking page time:", error.message);
  }
});

/**
 * Calculate engagement score based on user interactions
 */
const calculateEngagementScore = ({ timeSpent, scrollDepth, imageInteractions, actions }) => {
  let score = 0;
  
  // Time spent scoring (0-40 points)
  score += Math.min(timeSpent / 30 * 40, 40); // 30 seconds = max points
  
  // Scroll depth scoring (0-20 points)
  score += scrollDepth / 100 * 20;
  
  // Image interactions (0-20 points)
  score += Math.min(imageInteractions * 5, 20);
  
  // Action bonuses (0-20 points)
  if (actions.priceChecked) score += 5;
  if (actions.reviewsViewed) score += 5;
  if (actions.specificationsViewed) score += 5;
  if (actions.addToCartClicked) score += 10;
  if (actions.addToWishlistClicked) score += 5;
  
  return Math.min(score, 100);
};

export default {
  trackProductInteraction,
  trackSearch,
  trackCartAdd,
  trackWishlistAdd,
  trackPageTime,
  trackProductView
};
