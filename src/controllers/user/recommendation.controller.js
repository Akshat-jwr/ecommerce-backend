import { Product } from "../../models/product.model.js";
import { UserBehavior } from "../../models/userBehavior.model.js";
import { UserActivity } from "../../models/userActivity.model.js";
import { Order } from "../../models/order.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Advanced Recommendation Engine
 */
class RecommendationEngine {
  
  /**
   * Get collaborative filtering recommendations
   */
  static async getCollaborativeRecommendations(userId, limit = 10) {
    const pipeline = [
      // Find users with similar behavior
      {
        $match: {
          userId: { $ne: new mongoose.Types.ObjectId(userId) },
          interactionType: { $in: ["product_view", "cart_add", "purchase"] },
          engagementScore: { $gte: 50 }
        }
      },
      {
        $lookup: {
          from: "userbehaviors",
          let: { productId: "$productId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$productId", "$$productId"] },
                    { $eq: ["$userId", new mongoose.Types.ObjectId(userId)] },
                    { $gte: ["$engagementScore", 30] }
                  ]
                }
              }
            }
          ],
          as: "userInteraction"
        }
      },
      { $match: { userInteraction: { $size: 0 } } }, // Products user hasn't interacted with
      {
        $group: {
          _id: "$productId",
          similarUsers: { $addToSet: "$userId" },
          avgEngagement: { $avg: "$engagementScore" },
          totalInteractions: { $sum: 1 }
        }
      },
      {
        $project: {
          productId: "$_id",
          score: {
            $multiply: [
              "$avgEngagement",
              { $log10: { $add: ["$totalInteractions", 1] } },
              { $size: "$similarUsers" }
            ]
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: limit }
    ];

    const recommendations = await UserBehavior.aggregate(pipeline);
    
    const productIds = recommendations.map(r => r.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .populate("category", "name")
      .lean();

    return products.map(product => {
      const rec = recommendations.find(r => r.productId.toString() === product._id.toString());
      return {
        product,
        score: rec?.score || 0,
        reason: "Users with similar interests also liked this",
        type: "collaborative"
      };
    });
  }

  /**
   * Get content-based recommendations
   */
  static async getContentBasedRecommendations(userId, limit = 10) {
    // Get user preferences
    const userPreferences = await UserBehavior.getUserPreferences(userId);
    
    if (userPreferences.length === 0) {
      return [];
    }

    const preferredCategories = userPreferences
      .filter(p => p.category)
      .slice(0, 3)
      .map(p => p.category);

    const preferredPriceRanges = userPreferences
      .map(p => p.priceRange)
      .slice(0, 2);

    // Get products user has already interacted with
    const interactedProducts = await UserBehavior.distinct("productId", {
      userId: new mongoose.Types.ObjectId(userId)
    });

    // Build content-based filter
    const filter = {
      _id: { $nin: interactedProducts },
      stock: { $gt: 0 }
    };

    if (preferredCategories.length > 0) {
      filter.category = { $in: preferredCategories };
    }

    // Price range filter based on preferences
    if (preferredPriceRanges.includes("budget")) {
      filter.price = { $lt: 1000 };
    } else if (preferredPriceRanges.includes("premium")) {
      filter.price = { $gte: 5000 };
    } else if (preferredPriceRanges.includes("mid")) {
      filter.price = { $gte: 1000, $lt: 5000 };
    }

    const products = await Product.find(filter)
      .populate("category", "name")
      .sort({ averageRating: -1, viewCount: -1 })
      .limit(limit)
      .lean();

    return products.map(product => ({
      product,
      score: this.calculateContentScore(product, userPreferences),
      reason: "Based on your browsing preferences",
      type: "content"
    }));
  }

  /**
   * Calculate content-based score
   */
  static calculateContentScore(product, userPreferences) {
    let score = 0;
    
    // Category match
    const categoryPref = userPreferences.find(p => 
      p.category && p.category.toString() === product.category._id.toString()
    );
    if (categoryPref) {
      score += categoryPref.score * 0.4;
    }

    // Price range match
    let priceRange = "mid";
    if (product.price < 1000) priceRange = "budget";
    else if (product.price >= 5000) priceRange = "premium";

    const pricePref = userPreferences.find(p => p.priceRange === priceRange);
    if (pricePref) {
      score += pricePref.score * 0.3;
    }

    // Product popularity
    score += (product.averageRating || 0) * 5;
    score += Math.log10((product.viewCount || 0) + 1) * 2;

    return Math.min(score, 100);
  }

  /**
   * Get trending products based on recent activity
   */
  static async getTrendingRecommendations(limit = 10, categoryId = null) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: oneWeekAgo },
          interactionType: { $in: ["product_view", "cart_add", "purchase"] }
        }
      },
      {
        $group: {
          _id: "$productId",
          viewCount: {
            $sum: { $cond: [{ $eq: ["$interactionType", "product_view"] }, 1, 0] }
          },
          cartAddCount: {
            $sum: { $cond: [{ $eq: ["$interactionType", "cart_add"] }, 1, 0] }
          },
          purchaseCount: {
            $sum: { $cond: [{ $eq: ["$interactionType", "purchase"] }, 1, 0] }
          },
          avgEngagement: { $avg: "$engagementScore" },
          uniqueUsers: { $addToSet: "$userId" }
        }
      },
      {
        $project: {
          productId: "$_id",
          trendingScore: {
            $add: [
              { $multiply: ["$viewCount", 1] },
              { $multiply: ["$cartAddCount", 3] },
              { $multiply: ["$purchaseCount", 5] },
              { $multiply: [{ $size: "$uniqueUsers" }, 2] },
              { $divide: ["$avgEngagement", 10] }
            ]
          }
        }
      },
      { $sort: { trendingScore: -1 } },
      { $limit: limit }
    ];

    const trending = await UserBehavior.aggregate(pipeline);
    
    const productIds = trending.map(t => t.productId);
    const filter = { _id: { $in: productIds }, stock: { $gt: 0 } };
    
    if (categoryId) {
      filter.category = categoryId;
    }

    const products = await Product.find(filter)
      .populate("category", "name")
      .lean();

    return products.map(product => {
      const trend = trending.find(t => t.productId.toString() === product._id.toString());
      return {
        product,
        score: trend?.trendingScore || 0,
        reason: "Trending this week",
        type: "trending"
      };
    });
  }

  /**
   * Get hybrid recommendations combining multiple approaches
   */
  static async getHybridRecommendations(userId, limit = 12) {
    const [collaborative, contentBased, trending] = await Promise.all([
      this.getCollaborativeRecommendations(userId, Math.ceil(limit * 0.4)),
      this.getContentBasedRecommendations(userId, Math.ceil(limit * 0.4)),
      this.getTrendingRecommendations(Math.ceil(limit * 0.2))
    ]);

    // Combine and deduplicate
    const allRecommendations = [...collaborative, ...contentBased, ...trending];
    const uniqueRecommendations = [];
    const seenProducts = new Set();

    for (const rec of allRecommendations) {
      const productId = rec.product._id.toString();
      if (!seenProducts.has(productId)) {
        seenProducts.add(productId);
        uniqueRecommendations.push(rec);
      }
    }

    // Sort by score and limit
    return uniqueRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

/**
 * Get personalized recommendations for user
 */
export const getPersonalizedRecommendations = asyncHandler(async (req, res) => {
  const { limit = 12, type = "all" } = req.query;
  const userId = req.user._id;

  let recommendations = [];

  switch (type) {
    case "collaborative":
      recommendations = await RecommendationEngine.getCollaborativeRecommendations(userId, limit);
      break;
    case "content":
      recommendations = await RecommendationEngine.getContentBasedRecommendations(userId, limit);
      break;
    case "trending":
      recommendations = await RecommendationEngine.getTrendingRecommendations(limit);
      break;
    default:
      recommendations = await RecommendationEngine.getHybridRecommendations(userId, limit);
  }

  return res.status(200).json(
    new ApiResponse(200, recommendations, "Personalized recommendations retrieved successfully")
  );
});

/**
 * Get product-based recommendations
 */
export const getProductRecommendations = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { limit = 6 } = req.query;

  // Get the current product
  const currentProduct = await Product.findById(productId).populate("category");
  if (!currentProduct) {
    return res.status(404).json(new ApiResponse(404, null, "Product not found"));
  }

  // Find similar products based on category and price range
  const priceRange = currentProduct.price * 0.3; // 30% price variance
  
  const similarProducts = await Product.find({
    _id: { $ne: productId },
    category: currentProduct.category._id,
    price: {
      $gte: currentProduct.price - priceRange,
      $lte: currentProduct.price + priceRange
    },
    stock: { $gt: 0 }
  })
    .populate("category", "name")
    .sort({ averageRating: -1, viewCount: -1 })
    .limit(limit)
    .lean();

  // Get users who viewed this product and what else they viewed
  const alsoViewedPipeline = [
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        interactionType: "product_view"
      }
    },
    {
      $lookup: {
        from: "userbehaviors",
        let: { userId: "$userId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$userId"] },
                  { $ne: ["$productId", new mongoose.Types.ObjectId(productId)] },
                  { $eq: ["$interactionType", "product_view"] }
                ]
              }
            }
          }
        ],
        as: "otherViews"
      }
    },
    { $unwind: "$otherViews" },
    {
      $group: {
        _id: "$otherViews.productId",
        viewCount: { $sum: 1 },
        avgEngagement: { $avg: "$otherViews.engagementScore" }
      }
    },
    {
      $project: {
        productId: "$_id",
        score: { $multiply: ["$viewCount", "$avgEngagement"] }
      }
    },
    { $sort: { score: -1 } },
    { $limit: limit }
  ];

  const alsoViewed = await UserBehavior.aggregate(alsoViewedPipeline);
  
  const alsoViewedIds = alsoViewed.map(av => av.productId);
  const alsoViewedProducts = await Product.find({ 
    _id: { $in: alsoViewedIds },
    stock: { $gt: 0 }
  })
    .populate("category", "name")
    .lean();

  // Combine similar and also viewed products
  const recommendations = [
    ...similarProducts.map(p => ({
      product: p,
      score: 80 + Math.random() * 20,
      reason: "Similar products in this category",
      type: "similar"
    })),
    ...alsoViewedProducts.map(p => {
      const av = alsoViewed.find(item => item.productId.toString() === p._id.toString());
      return {
        product: p,
        score: av?.score || 0,
        reason: "Customers who viewed this item also viewed",
        type: "also_viewed"
      };
    })
  ];

  // Remove duplicates and sort
  const uniqueRecommendations = [];
  const seenProducts = new Set();

  for (const rec of recommendations) {
    const prodId = rec.product._id.toString();
    if (!seenProducts.has(prodId)) {
      seenProducts.add(prodId);
      uniqueRecommendations.push(rec);
    }
  }

  const finalRecommendations = uniqueRecommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return res.status(200).json(
    new ApiResponse(200, finalRecommendations, "Product recommendations retrieved successfully")
  );
});

/**
 * Get category-based recommendations
 */
export const getCategoryRecommendations = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { limit = 12 } = req.query;
  const userId = req.user._id;

  // Get user's behavior in this category
  const userCategoryBehavior = await UserBehavior.find({
    userId,
    interactionType: { $in: ["product_view", "cart_add"] }
  })
    .populate({
      path: "productId",
      match: { category: categoryId },
      select: "category price"
    })
    .lean();

  const interactedProductIds = userCategoryBehavior
    .filter(b => b.productId)
    .map(b => b.productId._id);

  // Get recommendations in this category
  const recommendations = await Product.find({
    category: categoryId,
    _id: { $nin: interactedProductIds },
    stock: { $gt: 0 }
  })
    .populate("category", "name")
    .sort({ averageRating: -1, viewCount: -1 })
    .limit(limit)
    .lean();

  const result = recommendations.map(product => ({
    product,
    score: (product.averageRating || 0) * 20 + Math.log10((product.viewCount || 0) + 1) * 5,
    reason: `Popular in ${product.category.name}`,
    type: "category"
  }));

  return res.status(200).json(
    new ApiResponse(200, result, "Category recommendations retrieved successfully")
  );
});

/**
 * Get recently viewed products
 */
export const getRecentlyViewed = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const userId = req.user._id;

  const recentViews = await UserBehavior.find({
    userId,
    interactionType: "product_view"
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate({
      path: "productId",
      populate: {
        path: "category",
        select: "name"
      }
    })
    .lean();

  const products = recentViews
    .filter(view => view.productId && view.productId.stock > 0)
    .map(view => ({
      product: view.productId,
      viewedAt: view.timestamp,
      timeSpent: view.timeSpent,
      engagementScore: view.engagementScore
    }));

  return res.status(200).json(
    new ApiResponse(200, products, "Recently viewed products retrieved successfully")
  );
});

/**
 * Get trending products
 */
export const getTrendingProducts = asyncHandler(async (req, res) => {
  const { limit = 12, category } = req.query;

  const recommendations = await RecommendationEngine.getTrendingRecommendations(
    limit, 
    category
  );

  return res.status(200).json(
    new ApiResponse(200, recommendations, "Trending products retrieved successfully")
  );
});
