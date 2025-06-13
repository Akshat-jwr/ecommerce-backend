import mongoose from "mongoose";

const productImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  alt: {
    type: String,
    default: ""
  },
  width: Number,
  height: Number,
  size: Number, // in bytes
  format: String
}, { _id: true });

const variantSchema = new mongoose.Schema({
  name: String,
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  price: Number,
  stock: Number,
  attributes: {
    color: String,
    size: String,
    weight: Number
  },
  images: [String] // indices of main product images
});

const discountSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["percentage", "fixed", "bulk", "tiered"],
    default: "percentage"
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  minQuantity: {
    type: Number,
    default: 1
  },
  maxQuantity: Number,
  startDate: Date,
  endDate: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  conditions: {
    userRoles: [String],
    categories: [mongoose.Schema.Types.ObjectId],
    minOrderValue: Number
  }
});

const seoSchema = new mongoose.Schema({
  metaTitle: String,
  metaDescription: String,
  keywords: [String],
  slug: {
    type: String,
    unique: true,
    index: true
  },
  canonicalUrl: String
});

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true // Text search index
  },
  description: {
    type: String,
    required: true
  },
  shortDescription: {
    type: String,
    maxlength: 500
  },
  
  // Pricing and Inventory
  price: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  cost: {
    type: Number,
    min: 0 // Cost price for profit calculations
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  
  // Category and Classification
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
    index: true
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },
  brand: {
    type: String,
    index: true
  },
  tags: {
    type: [String],
    index: true
  },
  
  // Images and Media
  images: [productImageSchema],
  videos: [{
    url: String,
    publicId: String,
    thumbnail: String,
    duration: Number
  }],
  
  // Product Variants
  hasVariants: {
    type: Boolean,
    default: false
  },
  variants: [variantSchema],
  
  // Discounts
  discounts: [discountSchema],
  
  // Features and Specifications
  features: [String],
  specifications: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  customizationOptions: [{
    name: String,
    type: {
      type: String,
      enum: ["text", "select", "color", "image"]
    },
    options: [String],
    required: Boolean,
    additionalCost: Number
  }],
  
  // SEO and Analytics
  seo: seoSchema,
  viewCount: {
    type: Number,
    default: 0,
    index: true
  },
  
  // Ratings and Reviews
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    index: true
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  
  // Product Status
  status: {
    type: String,
    enum: ["draft", "active", "inactive", "archived"],
    default: "draft",
    index: true
  },
  isDigital: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Shipping and Logistics
  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  shippingClass: String,
  
  // Analytics and Tracking
  analytics: {
    conversionRate: {
      type: Number,
      default: 0
    },
    clickThroughRate: {
      type: Number,
      default: 0
    },
    lastOrderDate: Date,
    totalSales: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
  },
  
  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound Indexes for Performance
productSchema.index({ category: 1, status: 1, isFeatured: -1 });
productSchema.index({ price: 1, averageRating: -1 });
productSchema.index({ brand: 1, category: 1 });
productSchema.index({ status: 1, stock: 1 });
productSchema.index({ createdAt: -1, isFeatured: -1 });
productSchema.index({ "seo.slug": 1 }, { unique: true, sparse: true });

// Text Search Index
productSchema.index({
  name: "text",
  description: "text",
  "seo.keywords": "text",
  tags: "text"
}, {
  weights: {
    name: 10,
    tags: 5,
    description: 2,
    "seo.keywords": 3
  }
});

// Virtual Fields
productSchema.virtual('isInStock').get(function() {
  return this.stock > 0;
});

productSchema.virtual('isLowStock').get(function() {
  return this.stock <= this.lowStockThreshold && this.stock > 0;
});

productSchema.virtual('currentPrice').get(function() {
  const activeDiscount = this.getActiveDiscount();
  if (!activeDiscount) return this.price;
  
  if (activeDiscount.type === 'percentage') {
    return this.price * (1 - activeDiscount.value / 100);
  } else if (activeDiscount.type === 'fixed') {
    return Math.max(0, this.price - activeDiscount.value);
  }
  return this.price;
});

productSchema.virtual('savings').get(function() {
  return this.price - this.currentPrice;
});

productSchema.virtual('discountPercentage').get(function() {
  if (this.price === 0) return 0;
  return Math.round((this.savings / this.price) * 100);
});

// Instance Methods
productSchema.methods.getActiveDiscount = function(quantity = 1, userRole = 'user') {
  const now = new Date();
  
  const activeDiscounts = this.discounts.filter(discount => {
    if (!discount.isActive) return false;
    if (discount.startDate && discount.startDate > now) return false;
    if (discount.endDate && discount.endDate < now) return false;
    if (discount.minQuantity && quantity < discount.minQuantity) return false;
    if (discount.maxQuantity && quantity > discount.maxQuantity) return false;
    if (discount.conditions.userRoles?.length && !discount.conditions.userRoles.includes(userRole)) return false;
    
    return true;
  });
  
  // Return the best discount
  return activeDiscounts.reduce((best, current) => {
    const currentValue = this.calculateDiscountValue(current, quantity);
    const bestValue = best ? this.calculateDiscountValue(best, quantity) : 0;
    return currentValue > bestValue ? current : best;
  }, null);
};

productSchema.methods.calculateDiscountValue = function(discount, quantity = 1) {
  switch (discount.type) {
    case 'percentage':
      return this.price * quantity * (discount.value / 100);
    case 'fixed':
      return discount.value * quantity;
    case 'bulk':
      return quantity >= discount.minQuantity ? this.price * quantity * (discount.value / 100) : 0;
    case 'tiered':
      // Implement tiered pricing logic
      return this.calculateTieredDiscount(discount, quantity);
    default:
      return 0;
  }
};

productSchema.methods.calculateTieredDiscount = function(discount, quantity) {
  // Tiered discount logic based on quantity
  const tiers = discount.tiers || [];
  let applicableTier = null;
  
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity) {
      applicableTier = tier;
    }
  }
  
  if (applicableTier) {
    return this.price * quantity * (applicableTier.discount / 100);
  }
  
  return 0;
};

productSchema.methods.updateAnalytics = function(action, value = 1) {
  switch (action) {
    case 'view':
      this.viewCount += 1;
      break;
    case 'sale':
      this.analytics.totalSales += value;
      this.analytics.lastOrderDate = new Date();
      break;
    case 'revenue':
      this.analytics.revenue += value;
      break;
  }
};

productSchema.methods.adjustStock = function(quantity, operation = 'decrease') {
  if (operation === 'decrease') {
    this.stock = Math.max(0, this.stock - quantity);
  } else {
    this.stock += quantity;
  }
};

// Static Methods
productSchema.statics.findLowStock = function() {
  return this.find({
    $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    status: "active"
  });
};

productSchema.statics.findFeatured = function(limit = 10) {
  return this.find({ isFeatured: true, status: "active" })
    .limit(limit)
    .sort({ averageRating: -1, viewCount: -1 });
};

productSchema.statics.searchProducts = function(query, filters = {}) {
  const searchQuery = {
    $text: { $search: query }
  };
  
  // Apply filters
  if (filters.category) searchQuery.category = filters.category;
  if (filters.brand) searchQuery.brand = filters.brand;
  if (filters.minPrice || filters.maxPrice) {
    searchQuery.price = {};
    if (filters.minPrice) searchQuery.price.$gte = filters.minPrice;
    if (filters.maxPrice) searchQuery.price.$lte = filters.maxPrice;
  }
  if (filters.inStock) searchQuery.stock = { $gt: 0 };
  
  return this.find(searchQuery, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" } });
};

// Middleware
productSchema.pre('save', function(next) {
  // Generate SEO slug if not provided
  if (!this.seo.slug && this.name) {
    this.seo.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  // Ensure at least one featured image
  if (this.images.length > 0 && !this.images.some(img => img.isFeatured)) {
    this.images[0].isFeatured = true;
  }
  
  next();
});

productSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

export const Product = mongoose.model("Product", productSchema);
