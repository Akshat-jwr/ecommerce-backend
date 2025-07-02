import { Review } from "../../models/review.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Create a product review (one per user per product)
 */
export const createReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId, rating, comment, images = [] } = req.body;

  if (!productId || !rating || !comment) {
    throw new ApiError(400, "Product, rating, and comment are required");
  }

  // Check if user already reviewed this product
  const existing = await Review.findOne({ productId, userId });
  if (existing) {
    throw new ApiError(400, "You have already reviewed this product");
  }

  // Optionally, check if user purchased the product for verified purchase
  // let isVerifiedPurchase = false;
  // ...your logic for checking purchase...

  const review = await Review.create({
    productId,
    userId,
    rating,
    comment,
    images,
    isVerifiedPurchase: false, // Set to true if you implement purchase check
  });

  return res.status(201).json(
    new ApiResponse(201, review, "Review created successfully")
  );
});

/**
 * Get all reviews by the authenticated user (paginated)
 */
/**
 * Get reviews - either all user's reviews OR all reviews for a specific product
 */
export const getUserReviews = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.query; // Check for productId query parameter
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  let filter = {};
  let populateOptions = {};

  if (productId) {
    // ✅ GET ALL REVIEWS FOR A SPECIFIC PRODUCT (from all users)
    filter = { productId };
    populateOptions = {
      path: "userId",
      select: "name avatar" // populate user info for product reviews
    };
  } else {
    // ✅ GET ALL REVIEWS BY THE CURRENT USER
    filter = { userId };
    populateOptions = {
      path: "productId",
      select: "name images" // populate product info for user's reviews
    };
  }

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate(populateOptions)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  const message = productId 
    ? "Product reviews retrieved successfully"
    : "User reviews retrieved successfully";

  return res.status(200).json(
    new ApiResponse(200, {
      reviews,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }, message)
  );
});


/**
 * Update a review (only by its owner)
 */
export const updateReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  const { rating, comment, images } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid review ID");
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  if (review.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You can only update your own reviews");
  }

  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  if (images !== undefined) review.images = images;

  await review.save();

  return res.status(200).json(
    new ApiResponse(200, review, "Review updated successfully")
  );
});

/**
 * Delete a review (only by its owner)
 */
export const deleteReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid review ID");
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  if (review.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You can only delete your own reviews");
  }

  await review.deleteOne();

  return res.status(200).json(
    new ApiResponse(200, {}, "Review deleted successfully")
  );
});
