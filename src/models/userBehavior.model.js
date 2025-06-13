import mongoose from "mongoose";

const imageInteractionSchema = new mongoose.Schema({
  imageIndex: {
    type: Number,
    required: true
  },
  action: {
    type: String,
    enum: ["view", "zoom", "hover", "click"],
    required: true
  },
  duration: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const userBehaviorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  interactionType: {
    type: String,
    enum: [
      "product_view",
      "search",
      "cart_add",
      "cart_remove",
      "wishlist_add",
      "wishlist_remove",
      "purchase",
      "page_engagement",
      "category_browse"
    ],
    required: true,
    index: true
  },
  
  // Product interaction specific data
  timeSpent: {
    type: Number,
    default: 0,
    index: true
  },
  scrollDepth: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  imageInteractions: [imageInteractionSchema],
  
  // Search specific data
  searchQuery: {
    type: String,
    index: true
  },
  searchFilters: {
    category: String,
    minPrice: Number,
    maxPrice: Number,
    sort: String,
    inStock: Boolean
  },
  
  // Cart/Purchase specific data
  quantity: {
    type: Number,
    default: 1
  },
  price: Number,
  
  // Engagement data
  actions: {
    priceChecked: { type: Boolean, default: false },
    reviewsViewed: { type: Boolean, default: false },
    specificationsViewed: { type: Boolean, default: false },
    addToCartClicked: { type: Boolean, default: false },
    addToWishlistClicked: { type: Boolean, default: false },
    shareClicked: { type: Boolean, default: false },
    compareClicked: { type: Boolean, default: false }
  },
  
  // Context information
  source: {
    type: String,
    enum: ["direct", "search", "recommendation", "category", "cart", "wishlist", "homepage"],
    default: "direct"
  },
  pageType: String,
  context: {
    device: String,
    platform: String,
    browser: String,
    referrer: String,
    location: String,
    viewport: {
      width: Number,
      height: Number
    }
  },
  
  // Calculated metrics
  engagementScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    index: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
userBehaviorSchema.index({ userId: 1, timestamp: -1 });
userBehaviorSchema.index({ productId: 1, timestamp: -1 });
userBehaviorSchema.index({ userId: 1, interactionType: 1, timestamp: -1 });
userBehaviorSchema.index({ searchQuery: "text" });

// TTL index to automatically delete old behavior data (optional)
userBehaviorSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // 1 year

// Pre-save middleware to calculate engagement score
userBehaviorSchema.pre('save', function(next) {
  if (this.interactionType === 'product_view' && this.timeSpent > 0) {
    this.engagementScore = this.calculateEngagementScore();
  }
  next();
});

// Method to calculate engagement score
userBehaviorSchema.methods.calculateEngagementScore = function() {
  let score = 0;
  
  // Time spent scoring (0-40 points)
  score += Math.min(this.timeSpent / 30 * 40, 40);
  
  // Scroll depth scoring (0-20 points)
  score += this.scrollDepth / 100 * 20;
  
  // Image interactions (0-20 points)
  score += Math.min(this.imageInteractions.length * 5, 20);
  
  // Action bonuses (0-20 points)
  if (this.actions.priceChecked) score += 5;
  if (this.actions.reviewsViewed) score += 5;
  if (this.actions.specificationsViewed) score += 5;
  if (this.actions.addToCartClicked) score += 10;
  if (this.actions.addToWishlistClicked) score += 5;
  
  return Math.min(score, 100);
};

// Static method to get user preferences
userBehaviorSchema.statics.getUserPreferences = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          category: "$product.category",
          priceRange: {
            $switch: {
              branches: [
                { case: { $lt: ["$product.price", 1000] }, then: "budget" },
                { case: { $lt: ["$product.price", 5000] }, then: "mid" },
                { case: { $gte: ["$product.price", 5000] }, then: "premium" }
              ],
              default: "unknown"
            }
          }
        },
        engagementSum: { $sum: "$engagementScore" },
        interactionCount: { $sum: 1 },
        avgTimeSpent: { $avg: "$timeSpent" }
      }
    },
    {
      $project: {
        category: "$_id.category",
        priceRange: "$_id.priceRange",
        score: {
          $multiply: [
            { $divide: ["$engagementSum", "$interactionCount"] },
            { $log10: { $add: ["$interactionCount", 1] } }
          ]
        },
        avgTimeSpent: 1
      }
    },
    { $sort: { score: -1 } }
  ];

  return await this.aggregate(pipeline);
};

export const UserBehavior = mongoose.model("UserBehavior", userBehaviorSchema);
