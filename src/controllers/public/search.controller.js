import { Product } from "../../models/product.model.js";
import { Category } from "../../models/category.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Global search across products and categories
 * @route GET /api/v1/public/search
 */
export const globalSearch = asyncHandler(async (req, res) => {
  const { q, type = "all" } = req.query;

  const searchResults = {};

  // Search products
  if (type === "all" || type === "products") {
    const productResults = await Product.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { features: { $regex: q, $options: "i" } }
      ]
    })
      .populate("category", "name")
      .select("name description price discountPercentage images stock averageRating")
      .limit(10)
      .lean();

    searchResults.products = productResults.map(product => ({
      ...product,
      discountedPrice: product.discountPercentage > 0 
        ? product.price * (1 - product.discountPercentage / 100) 
        : product.price,
      isInStock: product.stock > 0,
      featuredImage: product.images.find(img => img.isFeatured) || product.images[0],
      type: "product"
    }));
  }

  // Search categories
  if (type === "all" || type === "categories") {
    const categoryResults = await Category.aggregate([
      {
        $match: {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } }
          ]
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
          type: "category"
        }
      },
      {
        $project: {
          products: 0
        }
      },
      {
        $limit: 5
      }
    ]);

    searchResults.categories = categoryResults;
  }

  // Calculate total results
  const totalResults = {
    products: searchResults.products?.length || 0,
    categories: searchResults.categories?.length || 0,
    total: (searchResults.products?.length || 0) + (searchResults.categories?.length || 0)
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        ...searchResults, 
        totalResults,
        searchQuery: q 
      },
      "Global search results retrieved successfully"
    )
  );
});

/**
 * Get available filter options for products
 * @route GET /api/v1/public/filters
 */
export const getFilterOptions = asyncHandler(async (req, res) => {
  const { category } = req.query;

  // Build base filter
  const baseFilter = category ? { category: new mongoose.Types.ObjectId(category) } : {};

  // Get price range
  const priceStats = await Product.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: null,
        minPrice: { $min: "$price" },
        maxPrice: { $max: "$price" },
        avgPrice: { $avg: "$price" }
      }
    }
  ]);

  // Get categories with product counts
  const categoryFilter = [
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
      $match: {
        productCount: { $gt: 0 }
      }
    },
    {
      $project: {
        name: 1,
        productCount: 1
      }
    },
    {
      $sort: { name: 1 }
    }
  ];

  if (category) {
    // If filtering by category, get subcategories
    categoryFilter.unshift({
      $match: {
        parentCategory: new mongoose.Types.ObjectId(category)
      }
    });
  }

  const categories = await Category.aggregate(categoryFilter);

  // Get brands from product specifications (if your products have brand field)
  const brandResults = await Product.aggregate([
    { $match: baseFilter },
    {
      $match: {
        "specifications.brand": { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: "$specifications.brand",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1, _id: 1 }
    },
    {
      $limit: 20
    }
  ]);

  // Get stock status options
  const stockStats = await Product.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: null,
        inStock: {
          $sum: {
            $cond: [{ $gt: ["$stock", 0] }, 1, 0]
          }
        },
        outOfStock: {
          $sum: {
            $cond: [{ $eq: ["$stock", 0] }, 1, 0]
          }
        }
      }
    }
  ]);

  // Get rating distribution (if your products have averageRating field)
  const ratingStats = await Product.aggregate([
    { $match: baseFilter },
    {
      $match: {
        averageRating: { $exists: true, $gte: 0 }
      }
    },
    {
      $group: {
        _id: { $floor: "$averageRating" },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: -1 }
    }
  ]);

  const filterOptions = {
    priceRange: priceStats[0] || { minPrice: 0, maxPrice: 1000, avgPrice: 500 },
    categories,
    brands: brandResults.map(b => ({ name: b._id, count: b.count })),
    stockStatus: [
      { name: "in-stock", count: stockStats[0]?.inStock || 0 },
      { name: "out-of-stock", count: stockStats[0]?.outOfStock || 0 }
    ],
    ratings: ratingStats.map(r => ({ 
      rating: r._id, 
      count: r.count,
      label: `${r._id}+ stars`
    }))
  };

  return res.status(200).json(
    new ApiResponse(200, filterOptions, "Filter options retrieved successfully")
  );
});
