import { Category } from "../../models/category.model.js";
import { Product } from "../../models/product.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Get all categories in hierarchical structure
 * @route GET /api/v1/public/categories
 */
export const getAllCategories = asyncHandler(async (req, res) => {
  const { includeEmpty = false, parentOnly = false } = req.query;

  let pipeline = [
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "category",
        as: "products"
      }
    },
    {
      $addFields: {
        productCount: { $size: "$products" }
      }
    },
    {
      $project: {
        products: 0 // Remove the products array, keep only count
      }
    }
  ];

  // Filter out empty categories if requested
  if (includeEmpty === "false") {
    pipeline.push({
      $match: {
        productCount: { $gt: 0 }
      }
    });
  }

  // Filter for parent categories only
  if (parentOnly === "true") {
    pipeline.unshift({
      $match: {
        parentCategory: null
      }
    });
  }

  // Add sorting
  pipeline.push({
    $sort: { name: 1 }
  });

  const categories = await Category.aggregate(pipeline);

  // Build hierarchical structure
  const buildHierarchy = (categories, parentId = null) => {
    return categories
      .filter(cat => {
        const parent = cat.parentCategory;
        return parentId === null ? !parent : parent && parent.toString() === parentId.toString();
      })
      .map(cat => ({
        ...cat,
        children: buildHierarchy(categories, cat._id)
      }));
  };

  const hierarchicalCategories = parentOnly === "true" 
    ? categories 
    : buildHierarchy(categories);

  return res.status(200).json(
    new ApiResponse(200, hierarchicalCategories, "Categories retrieved successfully")
  );
});

/**
 * Get single category details
 * @route GET /api/v1/public/categories/:id
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const categoryPipeline = [
    {
      $match: { _id: new mongoose.Types.ObjectId(id) }
    },
    {
      $lookup: {
        from: "categories",
        localField: "parentCategory",
        foreignField: "_id",
        as: "parent"
      }
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "parentCategory",
        as: "children"
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "category",
        as: "products"
      }
    },
    {
      $addFields: {
        productCount: { $size: "$products" },
        parent: { $arrayElemAt: ["$parent", 0] },
        childrenCount: { $size: "$children" }
      }
    },
    {
      $project: {
        products: 0,
        "parent.description": 0,
        "parent.parentCategory": 0,
        "parent.createdAt": 0,
        "parent.updatedAt": 0,
        "children.description": 0,
        "children.parentCategory": 0,
        "children.createdAt": 0,
        "children.updatedAt": 0
      }
    }
  ];

  const [category] = await Category.aggregate(categoryPipeline);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return res.status(200).json(
    new ApiResponse(200, category, "Category retrieved successfully")
  );
});

/**
 * Get products in a specific category (alternative endpoint)
 * @route GET /api/v1/public/categories/:id/products
 */
export const getCategoryProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 12,
    sort = "newest",
    order = "desc",
    minPrice,
    maxPrice
  } = req.query;

  // Verify category exists
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = { category: id };

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
        category: { _id: category._id, name: category.name, description: category.description } 
      },
      "Category products retrieved successfully"
    )
  );
});
