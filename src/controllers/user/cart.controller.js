import { User } from "../../models/user.model.js";
import { Product } from "../../models/product.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * Get user's cart
 */
export const getCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: "cart.items.productId",
      populate: {
        path: "category",
        select: "name"
      }
    });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Calculate cart summary
  let totalPrice = 0;
  let totalItems = 0;
  const validItems = [];

  for (const item of user.cart.items) {
    if (!item.productId) continue;

    const product = item.productId;
    const discountedPrice = product.discountPercentage > 0 
      ? product.price * (1 - product.discountPercentage / 100)
      : product.price;

    const itemTotal = discountedPrice * item.quantity;
    totalPrice += itemTotal;
    totalItems += item.quantity;

    validItems.push({
      _id: item._id,
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        discountPercentage: product.discountPercentage,
        discountedPrice,
        images: product.images,
        stock: product.stock,
        category: product.category,
        isInStock: product.stock > 0
      },
      quantity: item.quantity,
      itemTotal,
      addedAt: item.addedAt
    });
  }

  const cartData = {
    items: validItems,
    summary: {
      totalItems,
      totalPrice,
      estimatedTax: totalPrice * 0.18,
      estimatedShipping: totalPrice > 1000 ? 0 : 100,
      estimatedTotal: totalPrice + (totalPrice * 0.18) + (totalPrice > 1000 ? 0 : 100)
    },
    updatedAt: user.cart.updatedAt
  };

  return res.status(200).json(
    new ApiResponse(200, cartData, "Cart retrieved successfully")
  );
});

/**
 * Add item to cart
 */
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, customizations } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (product.stock < quantity) {
    throw new ApiError(400, `Only ${product.stock} items available in stock`);
  }

  const user = await User.findById(req.user._id);

  const existingItemIndex = user.cart.items.findIndex(
    item => item.productId.toString() === productId
  );

  if (existingItemIndex > -1) {
    const newQuantity = user.cart.items[existingItemIndex].quantity + quantity;
    
    if (product.stock < newQuantity) {
      throw new ApiError(400, `Cannot add ${quantity} more items. Only ${product.stock - user.cart.items[existingItemIndex].quantity} more available`);
    }

    user.cart.items[existingItemIndex].quantity = newQuantity;
    if (customizations) {
      user.cart.items[existingItemIndex].customizations = customizations;
    }
  } else {
    user.cart.items.push({
      productId,
      quantity,
      customizations,
      addedAt: new Date()
    });
  }

  user.cart.updatedAt = new Date();
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Item added to cart successfully")
  );
});

/**
 * Update cart item quantity
 */
export const updateCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (product.stock < quantity) {
    throw new ApiError(400, `Only ${product.stock} items available in stock`);
  }

  const user = await User.findById(req.user._id);
  const itemIndex = user.cart.items.findIndex(
    item => item.productId.toString() === productId
  );

  if (itemIndex === -1) {
    throw new ApiError(404, "Item not found in cart");
  }

  user.cart.items[itemIndex].quantity = quantity;
  user.cart.updatedAt = new Date();
  
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Cart item updated successfully")
  );
});

/**
 * Remove item from cart
 */
export const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const user = await User.findById(req.user._id);
  const itemIndex = user.cart.items.findIndex(
    item => item.productId.toString() === productId
  );

  if (itemIndex === -1) {
    throw new ApiError(404, "Item not found in cart");
  }

  user.cart.items.splice(itemIndex, 1);
  user.cart.updatedAt = new Date();
  
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Item removed from cart successfully")
  );
});

/**
 * Clear entire cart
 */
export const clearCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  user.cart.items = [];
  user.cart.totalPrice = 0;
  user.cart.updatedAt = new Date();
  
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Cart cleared successfully")
  );
});

/**
 * Get cart summary
 */
export const getCartSummary = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("cart.items.productId", "price discountPercentage");

  const totalItems = user.cart.items.reduce((sum, item) => sum + item.quantity, 0);
  
  let totalPrice = 0;
  for (const item of user.cart.items) {
    if (item.productId) {
      const discountedPrice = item.productId.discountPercentage > 0 
        ? item.productId.price * (1 - item.productId.discountPercentage / 100)
        : item.productId.price;
      totalPrice += discountedPrice * item.quantity;
    }
  }

  const summary = {
    totalItems,
    totalPrice,
    estimatedTax: totalPrice * 0.18,
    estimatedShipping: totalPrice > 1000 ? 0 : 100,
    estimatedTotal: totalPrice + (totalPrice * 0.18) + (totalPrice > 1000 ? 0 : 100)
  };

  return res.status(200).json(
    new ApiResponse(200, summary, "Cart summary retrieved successfully")
  );
});
