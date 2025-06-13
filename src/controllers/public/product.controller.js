import { Product } from "../../models/product.model.js";
import { Category } from "../../models/category.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Get all products with advanced filtering, sorting, and pagination
 * @route GET /api/v1/public/products
 */
export const getAllProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    search = "",
    category,
    minPrice,
    maxPrice,
    sort = "newest",
    order = "desc",
    inStock
  } = req.query;

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  // Build filter object
  const filter = {};

  // Search filter
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { "features": { $regex: search, $options: "i" } }
    ];
  }

  // Category filter
  if (category) {
    filter.category = category;
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) {
      filter.price.$gte = parseFloat(minPrice);
    }
    if (maxPrice !== undefined) {
      filter.price.$lte = parseFloat(maxPrice);
    }
  }

  // Stock filter
  if (inStock !== undefined) {
    filter.stock = inStock === "true" ? { $gt: 0 } : { $eq: 0 };
  }

  // Build sort object
  let sortObject = {};
  switch (sort) {
    case "price":
      sortObject.price = order === "asc" ? 1 : -1;
      break;
    case "name":
      sortObject.name = order === "asc" ? 1 : -1;
      break;
    case "rating":
      sortObject.averageRating = order === "asc" ? 1 : -1;
      break;
    case "popularity":
      sortObject.viewCount = order === "asc" ? 1 : -1;
      break;
    case "newest":
    default:
      sortObject.createdAt = order === "asc" ? 1 : -1;
      break;
  }

  // Count total products
  const totalProducts = await Product.countDocuments(filter);

  // Get products with population
  const products = await Product.find(filter)
    .populate("category", "name")
    .select("-specifications -customizationOptions")
    .sort(sortObject)
    .skip(skip)
    .limit(limitNumber)
    .lean();

  // Add computed fields
  const enrichedProducts = products.map(product => ({
    ...product,
    discountedPrice: product.discountPercentage > 0 
      ? product.price * (1 - product.discountPercentage / 100) 
      : product.price,
    isInStock: product.stock > 0,
    featuredImage: product.images.find(img => img.isFeatured) || product.images[0]
  }));

  const pagination = {
    total: totalProducts,
    page: pageNumber,
    limit: limitNumber,
    pages: Math.ceil(totalProducts / limitNumber),
    hasNext: pageNumber < Math.ceil(totalProducts / limitNumber),
    hasPrev: pageNumber > 1
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      { products: enrichedProducts, pagination },
      "Products retrieved successfully"
    )
  );
});

/**
 * Get single product details
 * @route GET /api/v1/public/products/:id
 */
export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id)
    .populate("category", "name description")
    .lean();

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  // Add computed fields
  const enrichedProduct = {
    ...product,
    discountedPrice: product.discountPercentage > 0 
      ? product.price * (1 - product.discountPercentage / 100) 
      : product.price,
    isInStock: product.stock > 0,
    featuredImage: product.images.find(img => img.isFeatured) || product.images[0]
  };

  return res.status(200).json(
    new ApiResponse(200, enrichedProduct, "Product retrieved successfully")
  );
});

/**
 * Get featured products
 * @route GET /api/v1/public/products/featured
 */
export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query;
  const limitNumber = parseInt(limit, 10);

  // Get products with featured images or high ratings
  const products = await Product.find({
    $or: [
      { "images.isFeatured": true },
      { averageRating: { $gte: 4.0 } },
      { viewCount: { $gt: 100 } }
    ],
    stock: { $gt: 0 }
  })
    .populate("category", "name")
    .select("-specifications -customizationOptions")
    .sort({ averageRating: -1, viewCount: -1 })
    .limit(limitNumber)
    .lean();

  const enrichedProducts = products.map(product => ({
    ...product,
    discountedPrice: product.discountPercentage > 0 
      ? product.price * (1 - product.discountPercentage / 100) 
      : product.price,
    isInStock: product.stock > 0,
    featuredImage: product.images.find(img => img.isFeatured) || product.images[0]
  }));

  return res.status(200).json(
    new ApiResponse(200, enrichedProducts, "Featured products retrieved successfully")
  );
});

/**
 * Search products with autocomplete suggestions
 * @route GET /api/v1/public/products/search
 */
export const searchProducts = asyncHandler(async (req, res) => {
  const { 
    q, 
    suggestions = false,
    page = 1,
    limit = 12,
    category,
    minPrice,
    maxPrice,
    sort = "relevance"
  } = req.query;

  if (suggestions === "true") {
    // Return search suggestions
    const suggestionProducts = await Product.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } }
      ]
    })
      .select("name")
      .limit(5)
      .lean();

    const suggestions = suggestionProducts.map(p => p.name);
    const uniqueSuggestions = [...new Set(suggestions)];

    return res.status(200).json(
      new ApiResponse(200, uniqueSuggestions, "Search suggestions retrieved")
    );
  }

  // Full search with filters
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = {
    $or: [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { features: { $regex: q, $options: "i" } }
    ]
  };

  // Apply additional filters
  if (category) filter.category = category;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
  }

  // Sort by relevance (text score) or other criteria
  let sortObject = {};
  if (sort === "relevance") {
    // Use MongoDB text search for better relevance
    filter.$text = { $search: q };
    sortObject = { score: { $meta: "textScore" } };
  } else {
    sortObject = { createdAt: -1 };
  }

  const totalResults = await Product.countDocuments(filter);
  
  const products = await Product.find(filter)
    .populate("category", "name")
    .select("-specifications -customizationOptions")
    .sort(sortObject)
    .skip(skip)
    .limit(limitNumber)
    .lean();

  const enrichedProducts = products.map(product => ({
    ...product,
    discountedPrice: product.discountPercentage > 0 
      ? product.price * (1 - product.discountPercentage / 100) 
      : product.price,
    isInStock: product.stock > 0,
    featuredImage: product.images.find(img => img.isFeatured) || product.images[0]
  }));

  const pagination = {
    total: totalResults,
    page: pageNumber,
    limit: limitNumber,
    pages: Math.ceil(totalResults / limitNumber),
    hasNext: pageNumber < Math.ceil(totalResults / limitNumber),
    hasPrev: pageNumber > 1
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      { products: enrichedProducts, pagination, searchQuery: q },
      "Search results retrieved successfully"
    )
  );
});

/**
 * Get products by category
 * @route GET /api/v1/public/products/category/:categoryId
 */
export const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const {
    page = 1,
    limit = 12,
    sort = "newest",
    order = "desc",
    minPrice,
    maxPrice
  } = req.query;

  // Verify category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = { category: categoryId };

  // Price filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
  }

  // Sort options
  let sortObject = {};
  switch (sort) {
    case "price":
      sortObject.price = order === "asc" ? 1 : -1;
      break;
    case "name":
      sortObject.name = order === "asc" ? 1 : -1;
      break;
    case "rating":
      sortObject.averageRating = order === "asc" ? 1 : -1;
      break;
    default:
      sortObject.createdAt = order === "asc" ? 1 : -1;
  }

  const totalProducts = await Product.countDocuments(filter);
  
  const products = await Product.find(filter)
    .populate("category", "name")
    .select("-specifications -customizationOptions")
    .sort(sortObject)
    .skip(skip)
    .limit(limitNumber)
    .lean();

  const enrichedProducts = products.map(product => ({
    ...product,
    discountedPrice: product.discountPercentage > 0 
      ? product.price * (1 - product.discountPercentage / 100) 
      : product.price,
    isInStock: product.stock > 0,
    featuredImage: product.images.find(img => img.isFeatured) || product.images[0]
  }));

  const pagination = {
    total: totalProducts,
    page: pageNumber,
    limit: limitNumber,
    pages: Math.ceil(totalProducts / limitNumber),
    hasNext: pageNumber < Math.ceil(totalProducts / limitNumber),
    hasPrev: pageNumber > 1
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        products: enrichedProducts, 
        pagination, 
        category: { _id: category._id, name: category.name } 
      },
      "Category products retrieved successfully"
    )
  );
});

/**
 * Get related products
 * @route GET /api/v1/public/products/:id/related
 */
export const getRelatedProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 6 } = req.query;
  const limitNumber = parseInt(limit, 10);

  // Get the current product
  const currentProduct = await Product.findById(id);
  if (!currentProduct) {
    throw new ApiError(404, "Product not found");
  }

  // Find related products based on category and similar price range
  const priceRange = currentProduct.price * 0.5; // 50% price variance
  
  const relatedProducts = await Product.find({
    _id: { $ne: id }, // Exclude current product
    category: currentProduct.category,
    price: {
      $gte: currentProduct.price - priceRange,
      $lte: currentProduct.price + priceRange
    },
    stock: { $gt: 0 }
  })
    .populate("category", "name")
    .select("-specifications -customizationOptions")
    .sort({ averageRating: -1, viewCount: -1 })
    .limit(limitNumber)
    .lean();

  // If not enough related products, fill with random products from same category
  if (relatedProducts.length < limitNumber) {
    const additionalProducts = await Product.find({
      _id: { 
        $ne: id,
        $nin: relatedProducts.map(p => p._id)
      },
      category: currentProduct.category,
      stock: { $gt: 0 }
    })
      .populate("category", "name")
      .select("-specifications -customizationOptions")
      .limit(limitNumber - relatedProducts.length)
      .lean();

    relatedProducts.push(...additionalProducts);
  }

  const enrichedProducts = relatedProducts.map(product => ({
    ...product,
    discountedPrice: product.discountPercentage > 0 
      ? product.price * (1 - product.discountPercentage / 100) 
      : product.price,
    isInStock: product.stock > 0,
    featuredImage: product.images.find(img => img.isFeatured) || product.images[0]
  }));

  return res.status(200).json(
    new ApiResponse(200, enrichedProducts, "Related products retrieved successfully")
  );
});
