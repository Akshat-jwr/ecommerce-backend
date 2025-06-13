import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  uploadAvatar,
  deleteAccount,
  getUserDashboard
} from "../controllers/user/profile.controller.js";
import {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary
} from "../controllers/user/cart.controller.js";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  moveWishlistToCart
} from "../controllers/user/wishlist.controller.js";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getOrderTracking
} from "../controllers/user/order.controller.js";
import {
  addAddress,
  getUserAddresses,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from "../controllers/user/address.controller.js";
import {
  createReview,
  getUserReviews,
  updateReview,
  deleteReview
} from "../controllers/user/review.controller.js";
import {
  getPersonalizedRecommendations,
  getProductRecommendations,
  getCategoryRecommendations,
  getRecentlyViewed,
  getTrendingProducts
} from "../controllers/user/recommendation.controller.js";
import {
  trackProductView,
  trackProductInteraction,
  trackCartAdd,
  trackWishlistAdd,
  trackSearch,
  trackPageTime
} from "../middlewares/activity.middleware.js";
import {
  userValidationRules,
  paginationRules,
  isValidObjectId,
  validate
} from "../middlewares/validator.middleware.js";
import { uploadToMemory } from "../middlewares/multer.middleware.js";
import { body, query } from "express-validator";

const router = Router();

// Protect all user routes
router.use(verifyJWT);

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         phone:
 *           type: string
 *         avatar:
 *           type: string
 *         preferences:
 *           type: object
 *           properties:
 *             categories:
 *               type: array
 *               items:
 *                 type: string
 *             priceRange:
 *               type: object
 *               properties:
 *                 min:
 *                   type: number
 *                 max:
 *                   type: number
 *         addresses:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Address'
 *         
 *     Address:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         label:
 *           type: string
 *         street:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 *         country:
 *           type: string
 *         postalCode:
 *           type: string
 *         isDefault:
 *           type: boolean
 *           
 *     CartItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         product:
 *           $ref: '#/components/schemas/PublicProduct'
 *         quantity:
 *           type: number
 *         customizations:
 *           type: object
 *         addedAt:
 *           type: string
 *           format: date-time
 *           
 *     Order:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         orderNumber:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               product:
 *                 $ref: '#/components/schemas/PublicProduct'
 *               quantity:
 *                 type: number
 *               price:
 *                 type: number
 *         shippingAddress:
 *           $ref: '#/components/schemas/Address'
 *         paymentInfo:
 *           type: object
 *           properties:
 *             method:
 *               type: string
 *               enum: [upi, credit_card, cash_on_delivery]
 *             status:
 *               type: string
 *               enum: [pending, completed, failed, refunded]
 *             transactionId:
 *               type: string
 *         subtotal:
 *           type: number
 *         tax:
 *           type: number
 *         shipping:
 *           type: number
 *         total:
 *           type: number
 *         status:
 *           type: string
 *           enum: [pending, processing, shipped, delivered, cancelled]
 *         createdAt:
 *           type: string
 *           format: date-time
 *           
 *     Review:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         user:
 *           type: string
 *         product:
 *           type: string
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         comment:
 *           type: string
 *         verified:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *           
 *     Recommendation:
 *       type: object
 *       properties:
 *         product:
 *           $ref: '#/components/schemas/PublicProduct'
 *         score:
 *           type: number
 *         reason:
 *           type: string
 *         type:
 *           type: string
 *           enum: [collaborative, content, trending, recently_viewed]
 */

/**
 * @swagger
 * tags:
 *   - name: User Profile
 *     description: User profile management
 *   - name: User Cart
 *     description: Shopping cart operations
 *   - name: User Wishlist
 *     description: Wishlist management
 *   - name: User Orders
 *     description: Order management with payment processing
 *   - name: User Addresses
 *     description: Address management
 *   - name: User Reviews
 *     description: Product reviews
 *   - name: User Recommendations
 *     description: Personalized recommendations
 */

// PROFILE ROUTES
/**
 * @swagger
 * /api/v1/user/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 */
router.get("/profile", getUserProfile);

/**
 * @swagger
 * /api/v1/user/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put("/profile", 
  body("name").optional().trim().isLength({ min: 2, max: 50 }),
  body("phone").optional().matches(/^[0-9]{10}$/),
  validate,
  updateUserProfile
);

/**
 * @swagger
 * /api/v1/user/change-password:
 *   patch:
 *     summary: Change user password
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.patch("/change-password",
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 8 }).matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/),
  validate,
  changePassword
);

/**
 * @swagger
 * /api/v1/user/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 */
router.post("/avatar", uploadToMemory.single("avatar"), uploadAvatar);

/**
 * @swagger
 * /api/v1/user/dashboard:
 *   get:
 *     summary: Get user dashboard data
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get("/dashboard", getUserDashboard);

/**
 * @swagger
 * /api/v1/user/account:
 *   delete:
 *     summary: Delete user account
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 */
router.delete("/account", deleteAccount);

// CART ROUTES
/**
 * @swagger
 * /api/v1/user/cart:
 *   get:
 *     summary: Get user's cart
 *     tags: [User Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CartItem'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalItems:
 *                           type: number
 *                         totalPrice:
 *                           type: number
 *                         estimatedShipping:
 *                           type: number
 */
router.get("/cart", getCart);

/**
 * @swagger
 * /api/v1/user/cart:
 *   post:
 *     summary: Add item to cart
 *     tags: [User Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *                 minimum: 1
 *               customizations:
 *                 type: object
 *     responses:
 *       200:
 *         description: Item added to cart successfully
 */
router.post("/cart",
  body("productId").isMongoId().withMessage("Invalid product ID"),
  body("quantity").isInt({ min: 1, max: 99 }).withMessage("Quantity must be between 1 and 99"),
  validate,
  trackCartAdd,
  addToCart
);

/**
 * @swagger
 * /api/v1/user/cart/{productId}:
 *   patch:
 *     summary: Update cart item quantity
 *     tags: [User Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: number
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 */
router.patch("/cart/:productId",
  isValidObjectId("productId"),
  body("quantity").isInt({ min: 1, max: 99 }),
  validate,
  updateCartItem
);

/**
 * @swagger
 * /api/v1/user/cart/{productId}:
 *   delete:
 *     summary: Remove item from cart
 *     tags: [User Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item removed from cart successfully
 */
router.delete("/cart/:productId", isValidObjectId("productId"), validate, removeFromCart);

/**
 * @swagger
 * /api/v1/user/cart:
 *   delete:
 *     summary: Clear entire cart
 *     tags: [User Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 */
router.delete("/cart", clearCart);

/**
 * @swagger
 * /api/v1/user/cart/summary:
 *   get:
 *     summary: Get cart summary
 *     tags: [User Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart summary retrieved successfully
 */
router.get("/cart/summary", getCartSummary);

// WISHLIST ROUTES
/**
 * @swagger
 * /api/v1/user/wishlist:
 *   get:
 *     summary: Get user's wishlist
 *     tags: [User Wishlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Wishlist retrieved successfully
 */
router.get("/wishlist", paginationRules, validate, getWishlist);

/**
 * @swagger
 * /api/v1/user/wishlist:
 *   post:
 *     summary: Add item to wishlist
 *     tags: [User Wishlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item added to wishlist successfully
 */
router.post("/wishlist",
  body("productId").isMongoId().withMessage("Invalid product ID"),
  validate,
  trackWishlistAdd,
  addToWishlist
);

/**
 * @swagger
 * /api/v1/user/wishlist/{productId}:
 *   delete:
 *     summary: Remove item from wishlist
 *     tags: [User Wishlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item removed from wishlist successfully
 */
router.delete("/wishlist/:productId", isValidObjectId("productId"), validate, removeFromWishlist);

/**
 * @swagger
 * /api/v1/user/wishlist/move-to-cart:
 *   post:
 *     summary: Move item from wishlist to cart
 *     tags: [User Wishlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *                 default: 1
 *     responses:
 *       200:
 *         description: Item moved to cart successfully
 */
router.post("/wishlist/move-to-cart", moveWishlistToCart);

// ORDER ROUTES
/**
 * @swagger
 * /api/v1/user/orders:
 *   get:
 *     summary: Get user orders with filtering
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, shipped, delivered, cancelled]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 */
router.get("/orders", paginationRules, validate, getUserOrders);

/**
 * @swagger
 * /api/v1/user/orders:
 *   post:
 *     summary: Create new order with payment processing
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shippingAddressId
 *               - paymentMethod
 *             properties:
 *               shippingAddressId:
 *                 type: string
 *                 description: ID of shipping address from user's addresses
 *               billingAddressId:
 *                 type: string
 *                 description: ID of billing address (optional, uses shipping if not provided)
 *               paymentMethod:
 *                 type: string
 *                 enum: [upi, credit_card, cash_on_delivery]
 *                 description: Payment method (COD only available for pincode 712248)
 *               paymentData:
 *                 type: object
 *                 description: Payment specific data
 *                 properties:
 *                   upiId:
 *                     type: string
 *                     description: Required for UPI payments
 *                   cardNumber:
 *                     type: string
 *                     description: Required for card payments
 *                   expiryMonth:
 *                     type: string
 *                     description: Required for card payments
 *                   expiryYear:
 *                     type: string
 *                     description: Required for card payments
 *                   cvv:
 *                     type: string
 *                     description: Required for card payments
 *               notes:
 *                 type: string
 *                 description: Optional order notes
 *               couponCode:
 *                 type: string
 *                 description: Optional coupon code
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid request data or payment failed
 */
router.post("/orders", createOrder);

/**
 * @swagger
 * /api/v1/user/orders/{id}:
 *   get:
 *     summary: Get order details
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 */
router.get("/orders/:id", isValidObjectId("id"), validate, getOrderById);

/**
 * @swagger
 * /api/v1/user/orders/{id}/cancel:
 *   patch:
 *     summary: Cancel order
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 */
router.patch("/orders/:id/cancel", 
  isValidObjectId("id"), 
  body("reason").optional().isLength({ max: 200 }),
  validate, 
  cancelOrder
);

/**
 * @swagger
 * /api/v1/user/orders/{id}/tracking:
 *   get:
 *     summary: Get order tracking information
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order tracking information retrieved successfully
 */
router.get("/orders/:id/tracking", isValidObjectId("id"), validate, getOrderTracking);


// ADDRESS ROUTES
/**
 * @swagger
 * /api/v1/user/addresses:
 *   get:
 *     summary: Get user addresses
 *     tags: [User Addresses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully
 */
router.get("/addresses", getUserAddresses);

/**
 * @swagger
 * /api/v1/user/addresses:
 *   post:
 *     summary: Add new address
 *     tags: [User Addresses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - label
 *               - street
 *               - city
 *               - state
 *               - postalCode
 *               - country
 *             properties:
 *               label:
 *                 type: string
 *                 description: Address label (e.g., Home, Office)
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               postalCode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *               country:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Address added successfully
 */
router.post("/addresses",
  body("label").trim().notEmpty().withMessage("Address label is required"),
  body("street").trim().notEmpty().withMessage("Street address is required"),
  body("city").trim().notEmpty().withMessage("City is required"),
  body("state").trim().notEmpty().withMessage("State is required"),
  body("postalCode").matches(/^[0-9]{6}$/).withMessage("Valid postal code required"),
  body("country").trim().notEmpty().withMessage("Country is required"),
  validate,
  addAddress
);

/**
 * @swagger
 * /api/v1/user/addresses/{id}:
 *   put:
 *     summary: Update address
 *     tags: [User Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Address updated successfully
 */
router.put("/addresses/:id", isValidObjectId("id"), validate, updateAddress);

/**
 * @swagger
 * /api/v1/user/addresses/{id}:
 *   delete:
 *     summary: Delete address
 *     tags: [User Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Address deleted successfully
 */
router.delete("/addresses/:id", isValidObjectId("id"), validate, deleteAddress);

/**
 * @swagger
 * /api/v1/user/addresses/{id}/default:
 *   patch:
 *     summary: Set default address
 *     tags: [User Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Default address set successfully
 */
router.patch("/addresses/:id/default", isValidObjectId("id"), validate, setDefaultAddress);

// REVIEW ROUTES
/**
 * @swagger
 * /api/v1/user/reviews:
 *   post:
 *     summary: Create product review
 *     tags: [User Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - rating
 *               - comment
 *             properties:
 *               productId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Review created successfully
 */
router.post("/reviews",
  body("productId").isMongoId().withMessage("Invalid product ID"),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("comment").trim().isLength({ min: 10, max: 500 }).withMessage("Comment must be between 10 and 500 characters"),
  validate,
  createReview
);

/**
 * @swagger
 * /api/v1/user/reviews:
 *   get:
 *     summary: Get user reviews
 *     tags: [User Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get("/reviews", paginationRules, validate, getUserReviews);

/**
 * @swagger
 * /api/v1/user/reviews/{id}:
 *   put:
 *     summary: Update review
 *     tags: [User Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review updated successfully
 */
router.put("/reviews/:id", isValidObjectId("id"), validate, updateReview);

/**
 * @swagger
 * /api/v1/user/reviews/{id}:
 *   delete:
 *     summary: Delete review
 *     tags: [User Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted successfully
 */
router.delete("/reviews/:id", isValidObjectId("id"), validate, deleteReview);

// RECOMMENDATION ROUTES
/**
 * @swagger
 * /api/v1/user/recommendations:
 *   get:
 *     summary: Get personalized recommendations
 *     tags: [User Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, collaborative, content, trending]
 *           default: all
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Recommendation'
 */
router.get("/recommendations",
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit must be between 1 and 50"),
  query("type").optional().isIn(["all", "collaborative", "content", "trending"]),
  validate,
  getPersonalizedRecommendations
);

/**
 * @swagger
 * /api/v1/user/recommendations/product/{productId}:
 *   get:
 *     summary: Get product-based recommendations
 *     tags: [User Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 6
 *     responses:
 *       200:
 *         description: Product recommendations retrieved successfully
 */
router.get("/recommendations/product/:productId",
  isValidObjectId("productId"),
  query("limit").optional().isInt({ min: 1, max: 20 }),
  validate,
  getProductRecommendations
);

/**
 * @swagger
 * /api/v1/user/recommendations/category/{categoryId}:
 *   get:
 *     summary: Get category-based recommendations
 *     tags: [User Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Category recommendations retrieved successfully
 */
router.get("/recommendations/category/:categoryId",
  isValidObjectId("categoryId"),
  validate,
  getCategoryRecommendations
);

/**
 * @swagger
 * /api/v1/user/recommendations/trending:
 *   get:
 *     summary: Get trending products
 *     tags: [User Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trending products retrieved successfully
 */
router.get("/recommendations/trending", getTrendingProducts);

/**
 * @swagger
 * /api/v1/user/recently-viewed:
 *   get:
 *     summary: Get recently viewed products
 *     tags: [User Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Recently viewed products retrieved successfully
 */
router.get("/recently-viewed", 
  query("limit").optional().isInt({ min: 1, max: 20 }),
  validate,
  getRecentlyViewed
);

// ACTIVITY TRACKING ROUTES
/**
 * @swagger
 * /api/v1/user/track/product-view/{productId}:
 *   post:
 *     summary: Track product view with detailed interaction data
 *     tags: [User Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timeSpent:
 *                 type: number
 *                 description: Time spent on product page in seconds
 *               scrollDepth:
 *                 type: number
 *                 description: Scroll depth percentage
 *               imageInteractions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     imageIndex:
 *                       type: number
 *                     action:
 *                       type: string
 *                       enum: [view, zoom, hover]
 *                     duration:
 *                       type: number
 *               source:
 *                 type: string
 *                 description: How user reached this product
 *               priceChecked:
 *                 type: boolean
 *               reviewsViewed:
 *                 type: boolean
 *               specificationsViewed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product interaction tracked successfully
 */
router.post("/track/product-view/:productId",
  isValidObjectId("productId"),
  body("timeSpent").isNumeric().withMessage("Time spent must be a number"),
  body("scrollDepth").optional().isFloat({ min: 0, max: 100 }),
  validate,
  trackProductInteraction
);

/**
 * @swagger
 * /api/v1/user/track/page-time:
 *   post:
 *     summary: Track page engagement time
 *     tags: [User Recommendations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pageType
 *               - timeSpent
 *             properties:
 *               pageType:
 *                 type: string
 *               timeSpent:
 *                 type: number
 *               interactions:
 *                 type: object
 *     responses:
 *       200:
 *         description: Page engagement tracked successfully
 */
router.post("/track/page-time",
  body("pageType").notEmpty().withMessage("Page type is required"),
  body("timeSpent").isNumeric().withMessage("Time spent must be a number"),
  validate,
  trackPageTime
);

export default router;
