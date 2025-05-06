import mongoose from "mongoose";

/**
 * User Activity Model
 * Tracks user interactions with products for recommendation engine
 */
const userActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    activityType: {
        type: String,
        enum: ["view", "search", "wishlist_add", "wishlist_remove", "cart_add", "cart_remove", "purchase", "review"],
        required: true
    },
    // Store additional data based on activity type
    metadata: {
        searchQuery: String,
        reviewRating: Number,
        timeSpent: Number, // Time spent viewing product in seconds
        purchaseQuantity: Number,
        clickSource: String, // Where the user clicked from (homepage, category page, search results)
    },
    // Store device and session information
    context: {
        device: String,
        platform: String,
        referrer: String,
        location: String
    }
}, { 
    timestamps: true,
    // Automatically expire old activity data (e.g., after 6 months)
    // Comment this out if you want to keep all history
    expires: 15552000 // 180 days in seconds
});

// Create compound index on userId and productId for faster lookups
userActivitySchema.index({ userId: 1, productId: 1 });

// Create index on activityType for analyzing behavior patterns
userActivitySchema.index({ activityType: 1 });

/**
 * Static method to log user activity
 * @param {Object} activityData - Activity data to log
 */
userActivitySchema.statics.logActivity = async function(activityData) {
    try {
        return await this.create(activityData);
    } catch (error) {
        console.error("Error logging user activity:", error);
        // Don't throw error here - recommendation tracking should fail gracefully
        return null;
    }
};

/**
 * Static method to get personalized recommendations for a user
 * @param {String} userId - User ID
 * @param {Number} limit - Number of recommendations to return
 * @returns {Promise<Array>} - Array of recommended product IDs
 */
userActivitySchema.statics.getRecommendations = async function(userId, limit = 5) {
    try {
        // Get products this user has viewed or added to cart but not purchased
        const viewedProducts = await this.aggregate([
            { 
                $match: { 
                    userId: new mongoose.Types.ObjectId(userId),
                    activityType: { $in: ["view", "cart_add", "wishlist_add"] }
                } 
            },
            { $group: { _id: "$productId", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: limit * 2 } // Get more than needed for filtering
        ]);
        
        // Get products this user has purchased (to exclude from recommendations)
        const purchasedProductIds = await this.distinct("productId", {
            userId: new mongoose.Types.ObjectId(userId),
            activityType: "purchase"
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
 * @returns {Promise<Array>} - Array of popular product IDs
 */
userActivitySchema.statics.getPopularProducts = async function(limit = 10) {
    try {
        const popularProducts = await this.aggregate([
            { $match: { activityType: { $in: ["view", "cart_add", "purchase", "wishlist_add"] } } },
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

