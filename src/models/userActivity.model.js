import mongoose from "mongoose";

/**
 * User Activity Model
 * Tracks user interactions with products for recommendation engine
 */
const userActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // Changed to false to allow anonymous tracking
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: false, // Changed to false for non-product activities like search
    index: true
  },
  activityType: {
    type: String,
    enum: [
      "view", 
      "search", 
      "wishlist_add", 
      "wishlist_remove", 
      "cart_add", 
      "cart_remove", 
      "purchase", 
      "review",
      "category_browse",
      "page_visit"
    ],
    required: true,
    index: true
  },
  // Store additional data based on activity type
  metadata: {
    searchQuery: String,
    reviewRating: Number,
    timeSpent: Number, // Time spent viewing product in seconds
    purchaseQuantity: Number,
    clickSource: String, // Where the user clicked from (homepage, category page, search results)
    categoryId: mongoose.Schema.Types.ObjectId, // For category browsing
    resultCount: Number, // For search results
    // Additional fields for different activity types
    pageUrl: String,
    referrer: String
  },
  // Store device and session information
  context: {
    device: String,
    platform: String,
    browser: String,
    referrer: String,
    location: String,
    userAgent: String,
    sessionId: String,
    ipAddress: String
  },
  // For anonymous users
  isAnonymous: {
    type: Boolean,
    default: false,
    index: true
  },
  anonymousId: {
    type: String, // Can be session ID or fingerprint for anonymous users
    index: true
  }
}, {
  timestamps: true,
  // Automatically expire old activity data (e.g., after 6 months)
  // Comment this out if you want to keep all history
  expires: 15552000 // 180 days in seconds
});

// Create compound indexes for better performance
userActivitySchema.index({ userId: 1, activityType: 1, createdAt: -1 });
userActivitySchema.index({ productId: 1, activityType: 1, createdAt: -1 });
userActivitySchema.index({ anonymousId: 1, activityType: 1, createdAt: -1 });
userActivitySchema.index({ isAnonymous: 1, activityType: 1, createdAt: -1 });

/**
 * Static method to log user activity with better error handling
 * @param {Object} activityData - Activity data to log
 */
userActivitySchema.statics.logActivity = async function(activityData) {
  try {
    // Validate and clean the activity data
    const cleanedData = {
      activityType: activityData.activityType,
      metadata: activityData.metadata || {},
      context: activityData.context || {},
      createdAt: new Date()
    };

    // Handle userId - if it's "anonymous" or not a valid ObjectId, treat as anonymous
    if (activityData.userId && 
        activityData.userId !== "anonymous" && 
        mongoose.Types.ObjectId.isValid(activityData.userId)) {
      cleanedData.userId = activityData.userId;
      cleanedData.isAnonymous = false;
    } else {
      cleanedData.isAnonymous = true;
      // Use session ID or generate anonymous ID for tracking
      cleanedData.anonymousId = activityData.anonymousId || 
                               activityData.context?.sessionId || 
                               `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Handle productId - only set if it's a valid ObjectId
    if (activityData.productId && 
        activityData.productId !== "search" && 
        mongoose.Types.ObjectId.isValid(activityData.productId)) {
      cleanedData.productId = activityData.productId;
    }

    // For search activities, store search query in metadata
    if (activityData.activityType === "search") {
      cleanedData.metadata.searchQuery = activityData.metadata?.searchQuery || 
                                        activityData.productId; // productId might contain search query
    }

    return await this.create(cleanedData);
  } catch (error) {
    console.error("Error logging user activity:", error.message);
    // Don't throw error here - recommendation tracking should fail gracefully
    return null;
  }
};

/**
 * Static method to get personalized recommendations for a user
 * @param {String} userId - User ID
 * @param {Number} limit - Number of recommendations to return
 * @returns {Promise} - Array of recommended product IDs
 */
userActivitySchema.statics.getRecommendations = async function(userId, limit = 5) {
  try {
    // Build match query for both authenticated and anonymous users
    const matchQuery = userId && mongoose.Types.ObjectId.isValid(userId) 
      ? { userId: new mongoose.Types.ObjectId(userId) }
      : { isAnonymous: true };

    // Get products this user has viewed or added to cart but not purchased
    const viewedProducts = await this.aggregate([
      {
        $match: {
          ...matchQuery,
          activityType: { $in: ["view", "cart_add", "wishlist_add"] },
          productId: { $exists: true }
        }
      },
      { $group: { _id: "$productId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit * 2 } // Get more than needed for filtering
    ]);

    // Get products this user has purchased (to exclude from recommendations)
    const purchasedProductIds = await this.distinct("productId", {
      ...matchQuery,
      activityType: "purchase",
      productId: { $exists: true }
    });

    // Filter out products already purchased
    const purchasedSet = new Set(purchasedProductIds.map(id => id.toString()));
    const recommendedProductIds = viewedProducts
      .filter(item => !purchasedSet.has(item._id.toString()))
      .slice(0, limit)
      .map(item => item._id);

    return recommendedProductIds;
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return [];
  }
};

/**
 * Static method to get popular products based on all user activity
 * @param {Number} limit - Number of products to return
 * @returns {Promise} - Array of popular product IDs
 */
userActivitySchema.statics.getPopularProducts = async function(limit = 10) {
  try {
    const popularProducts = await this.aggregate([
      { 
        $match: { 
          activityType: { $in: ["view", "cart_add", "purchase", "wishlist_add"] },
          productId: { $exists: true }
        } 
      },
      {
        $group: {
          _id: "$productId",
          score: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ["$activityType", "purchase"] }, then: 5 },
                  { case: { $eq: ["$activityType", "cart_add"] }, then: 3 },
                  { case: { $eq: ["$activityType", "wishlist_add"] }, then: 2 }
                ],
                default: 1 // view
              }
            }
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: limit }
    ]);

    return popularProducts.map(item => item._id);
  } catch (error) {
    console.error("Error getting popular products:", error);
    return [];
  }
};

export const UserActivity = mongoose.model("UserActivity", userActivitySchema);
