import { User } from "../../models/user.model.js";
import { Product } from "../../models/product.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * Get user's wishlist
 */
export const getWishlist = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const user = await User.findById(req.user._id)
    .populate({
      path: "wishlist",
      populate: {
        path: "category",
        select: "name"
      },
      options: {
        skip,
        limit: limitNumber
      }
    });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const totalItems = user.wishlist.length;
  const wishlistItems = user.wishlist.slice(skip, skip + limitNumber);

  // Add computed fields to products
  const enrichedWishlist = wishlistItems.map(product => ({
    ...product.toObject(),
    isInStock: product.stock > 0,
    discountedPrice: product.discountPercentage > 0 
      ? product.price * (1 - product.discountPercentage / 100)
      : product.price,
    featuredImage: product.images?.find(img => img.isFeatured) || product.images?.[0]
  }));

  const pagination = {
    total: totalItems,
    page: pageNumber,
    limit: limitNumber,
    pages: Math.ceil(totalItems / limitNumber),
    hasNext: pageNumber < Math.ceil(totalItems / limitNumber),
    hasPrev: pageNumber > 1
  };

  return res.status(200).json(
    new ApiResponse(200, { 
      items: enrichedWishlist, 
      pagination 
    }, "Wishlist retrieved successfully")
  );
});

/**
 * Add item to wishlist
 */
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  // Validate product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  const user = await User.findById(req.user._id);

  // Check if item already in wishlist
  if (user.wishlist.includes(productId)) {
    throw new ApiError(400, "Product already in wishlist");
  }

  user.wishlist.push(productId);
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Product added to wishlist successfully")
  );
});

/**
 * Remove item from wishlist
 */
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const user = await User.findById(req.user._id);

  // Check if item is in wishlist
  if (!user.wishlist.includes(productId)) {
    throw new ApiError(404, "Product not found in wishlist");
  }

  user.wishlist = user.wishlist.filter(
    id => id.toString() !== productId.toString()
  );
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Product removed from wishlist successfully")
  );
});

/**
 * Move item from wishlist to cart
 */
export const moveWishlistToCart = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const { quantity = 1 } = req.body;

  // Validate product exists and has stock
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (product.stock < quantity) {
    throw new ApiError(400, `Only ${product.stock} items available in stock`);
  }

  const user = await User.findById(req.user._id);

  // Check if item is in wishlist
  if (!user.wishlist.includes(productId)) {
    throw new ApiError(404, "Product not found in wishlist");
  }

  // Remove from wishlist
  user.wishlist = user.wishlist.filter(
    id => id.toString() !== productId.toString()
  );

  // Add to cart
  const existingCartItem = user.cart.items.find(
    item => item.productId.toString() === productId.toString()
  );

  if (existingCartItem) {
    existingCartItem.quantity += quantity;
  } else {
    user.cart.items.push({
      productId,
      quantity,
      addedAt: new Date()
    });
  }

  user.cart.updatedAt = new Date();
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Product moved from wishlist to cart successfully")
  );
});
