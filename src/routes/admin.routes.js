import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/admin.middleware.js";
import { uploadProductImage } from "../middlewares/multer.middleware.js";

// Import controllers
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct
} from "../controllers/admin/product.controller.js";

import {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} from "../controllers/admin/category.controller.js";

import {
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    deleteOrder
} from "../controllers/admin/order.controller.js";

import {
    getAllUsers,
    getUserById,
    updateUserRole,
    toggleUserActiveStatus,
    deleteUser
} from "../controllers/admin/user.controller.js";

// Import dashboard controllers
import {
    getDashboardStats,
    getOrderStats,
    getRevenueChartData
} from "../controllers/admin/dashboard.controller.js";

// Import validation middleware
import { 
    productValidationRules, 
    categoryValidationRules, 
    orderStatusValidationRules,
    paginationRules,
    isValidObjectId,
    validate 
} from "../middlewares/validator.middleware.js";

import { body } from "express-validator";

const router = Router();

// Protect all admin routes with authentication and admin role check
router.use(verifyJWT, verifyAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin operations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductImage:
 *       type: object
 *       properties:
 *         url:
 *           type: string
 *           description: URL of the image on Cloudinary
 *         publicId:
 *           type: string
 *           description: Public ID of the image on Cloudinary
 *         isFeatured:
 *           type: boolean
 *           description: Whether this is the featured/main image
 *           default: false
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - price
 *         - stock
 *         - category
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         name:
 *           type: string
 *           description: Product name
 *         description:
 *           type: string
 *           description: Product description
 *         price:
 *           type: number
 *           description: Product price
 *         discountPercentage:
 *           type: number
 *           description: Discount percentage (0-100)
 *         stock:
 *           type: number
 *           description: Available stock
 *         category:
 *           type: string
 *           description: Category ID
 *         images:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductImage'
 *           description: Array of product images
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of product features
 *         specifications:
 *           type: object
 *           description: Product specifications
 *         customizationOptions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *           description: Customization options
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     Category:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         name:
 *           type: string
 *           description: Category name
 *         description:
 *           type: string
 *           description: Category description
 *         parentCategory:
 *           type: string
 *           description: Parent category ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     OrderStatus:
 *       type: string
 *       enum: [pending, processing, shipped, delivered, cancelled, refunded]
 *       default: pending
 *     
 *     Order:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         user:
 *           type: string
 *           description: User ID
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               product:
 *                 type: string
 *                 description: Product ID
 *               quantity:
 *                 type: number
 *                 description: Quantity ordered
 *               price:
 *                 type: number
 *                 description: Price at time of purchase
 *               customizations:
 *                 type: object
 *                 description: Product customizations if any
 *         shippingAddress:
 *           type: object
 *           properties:
 *             fullName:
 *               type: string
 *             addressLine1:
 *               type: string
 *             addressLine2:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             postalCode:
 *               type: string
 *             country:
 *               type: string
 *             phone:
 *               type: string
 *         billingAddress:
 *           type: object
 *           properties:
 *             fullName:
 *               type: string
 *             addressLine1:
 *               type: string
 *             addressLine2:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             postalCode:
 *               type: string
 *             country:
 *               type: string
 *             phone:
 *               type: string
 *         paymentMethod:
 *           type: string
 *           description: Payment method used
 *         paymentStatus:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *           description: Status of payment
 *         totalAmount:
 *           type: number
 *           description: Total order amount
 *         tax:
 *           type: number
 *           description: Tax amount
 *         shippingCost:
 *           type: number
 *           description: Shipping cost
 *         status:
 *           $ref: '#/components/schemas/OrderStatus'
 *         trackingNumber:
 *           type: string
 *           description: Shipping tracking number
 *         notes:
 *           type: string
 *           description: Order notes
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     UserRole:
 *       type: string
 *       enum: [user, admin]
 *       default: user
 *     
 *     DashboardStats:
 *       type: object
 *       properties:
 *         counts:
 *           type: object
 *           properties:
 *             products:
 *               type: number
 *               description: Total number of products
 *             orders:
 *               type: number
 *               description: Total number of orders
 *             users:
 *               type: number
 *               description: Total number of users
 *             categories:
 *               type: number
 *               description: Total number of categories
 *         revenue:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *               description: Total revenue from all orders
 *             averageOrderValue:
 *               type: number
 *               description: Average order value
 *         recentActivity:
 *           type: object
 *           properties:
 *             recentOrders:
 *               type: array
 *               items:
 *                 type: object
 *             lowStockProducts:
 *               type: array
 *               items:
 *                 type: object
 */

// PRODUCT ROUTES

/**
 * @swagger
 * /api/v1/admin/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               discountPercentage:
 *                 type: number
 *               stock:
 *                 type: number
 *               category:
 *                 type: string
 *               features:
 *                 type: string
 *                 description: JSON string array of features
 *               specifications:
 *                 type: string
 *                 description: JSON object of specifications
 *               customizationOptions:
 *                 type: string
 *                 description: JSON array of customization options
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Product images to upload (max 5)
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
    "/products",
    uploadProductImage.array("images", 5), // Handle up to 5 image uploads
    productValidationRules,
    validate,
    createProduct
);

/**
 * @swagger
 * /api/v1/admin/products:
 *   get:
 *     summary: Get all products with filtering, sorting, and pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *         default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Field to sort by
 *         default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *         default: desc
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name or description
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *     responses:
 *       200:
 *         description: List of products
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
    "/products",
    paginationRules,
    validate,
    getAllProducts
);

/**
 * @swagger
 * /api/v1/admin/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Product not found
 */
router.get(
    "/products/:id",
    isValidObjectId("id"),
    validate,
    getProductById
);

/**
 * @swagger
 * /api/v1/admin/products/{id}:
 *   put:
 *     summary: Update product by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               discountPercentage:
 *                 type: number
 *               stock:
 *                 type: number
 *               category:
 *                 type: string
 *               features:
 *                 type: string
 *                 description: JSON string array of features
 *               specifications:
 *                 type: string
 *                 description: JSON object of specifications
 *               customizationOptions:
 *                 type: string
 *                 description: JSON array of customization options
 *               keepExistingImages:
 *                 type: string
 *                 enum: ['true', 'false']
 *                 description: Whether to keep existing images or replace them all
 *               imagesToRemove:
 *                 type: string
 *                 description: JSON array of image indices to remove
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: New product images to upload (max 5)
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Product not found
 */
router.put(
    "/products/:id",
    isValidObjectId("id"),
    uploadProductImage.array("images", 5), // Handle up to 5 image uploads
    validate,
    updateProduct
);

/**
 * @swagger
 * /api/v1/admin/products/{id}:
 *   delete:
 *     summary: Delete product by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Product not found
 */
router.delete(
    "/products/:id",
    isValidObjectId("id"),
    validate,
    deleteProduct
);

// CATEGORY ROUTES
/**
 * @swagger
 * /api/v1/admin/categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Category already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post("/categories", categoryValidationRules, validate, createCategory);

/**
 * @swagger
 * /api/v1/admin/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: parentOnly
 *         schema:
 *           type: boolean
 *         description: Filter to return only parent categories
 *       - in: query
 *         name: childrenOf
 *         schema:
 *           type: string
 *         description: Filter to return children of a specific category
 *     responses:
 *       200:
 *         description: List of categories
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/categories", getAllCategories);

/**
 * @swagger
 * /api/v1/admin/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category details
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: Category not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/categories/:id", isValidObjectId("id"), validate, getCategoryById);

/**
 * @swagger
 * /api/v1/admin/categories/{id}:
 *   put:
 *     summary: Update category by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Category not found
 *       409:
 *         description: Category with this name already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.put("/categories/:id", isValidObjectId("id"), categoryValidationRules, validate, updateCategory);

/**
 * @swagger
 * /api/v1/admin/categories/{id}:
 *   delete:
 *     summary: Delete category by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       400:
 *         description: Invalid ID or cannot delete category with children/products
 *       404:
 *         description: Category not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete("/categories/:id", isValidObjectId("id"), validate, deleteCategory);

// ORDER ROUTES
/**
 * @swagger
 * /api/v1/admin/orders:
 *   get:
 *     summary: Get all orders with filtering, sorting, and pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/OrderStatus'
 *         description: Filter by order status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date (format YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date (format YYYY-MM-DD)
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *         description: Filter by minimum order amount
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: number
 *         description: Filter by maximum order amount
 *     responses:
 *       200:
 *         description: List of orders
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/orders", paginationRules, validate, getAllOrders);

/**
 * @swagger
 * /api/v1/admin/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order details
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/orders/:id", isValidObjectId("id"), validate, getOrderById);

/**
 * @swagger
 * /api/v1/admin/orders/{id}/status:
 *   patch:
 *     summary: Update order status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 $ref: '#/components/schemas/OrderStatus'
 *               notes:
 *                 type: string
 *               trackingNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.patch("/orders/:id/status", isValidObjectId("id"), orderStatusValidationRules, validate, updateOrderStatus);

/**
 * @swagger
 * /api/v1/admin/orders/{id}:
 *   delete:
 *     summary: Delete order by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order deleted successfully
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete("/orders/:id", isValidObjectId("id"), validate, deleteOrder);

// USER ROUTES
/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users with filtering, sorting, and pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name or email
 *       - in: query
 *         name: role
 *         schema:
 *           $ref: '#/components/schemas/UserRole'
 *         description: Filter by user role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/users", paginationRules, validate, getAllUsers);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/users/:id", isValidObjectId("id"), validate, getUserById);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Delete user by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Invalid ID or cannot delete your own account
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete("/users/:id", isValidObjectId("id"), validate, deleteUser);

/**
 * @swagger
 * /api/v1/admin/users/{id}/role:
 *   patch:
 *     summary: Update user role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 $ref: '#/components/schemas/UserRole'
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.patch("/users/:id/role", isValidObjectId("id"), body("role").isIn(["user", "admin"]), validate, updateUserRole);

/**
 * @swagger
 * /api/v1/admin/users/{id}/toggle-active:
 *   patch:
 *     summary: Toggle user active status (block/unblock)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User active status toggled successfully
 *       400:
 *         description: Invalid ID or cannot deactivate your own account
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.patch("/users/:id/toggle-active", isValidObjectId("id"), validate, toggleUserActiveStatus);

// DASHBOARD ROUTES

/**
 * @swagger
 * /api/v1/admin/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardStats'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/dashboard/stats", getDashboardStats);

/**
 * @swagger
 * /api/v1/admin/dashboard/orders-stats:
 *   get:
 *     summary: Get order statistics by status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/dashboard/orders-stats", getOrderStats);

/**
 * @swagger
 * /api/v1/admin/dashboard/revenue-chart:
 *   get:
 *     summary: Get revenue data for chart (last 7 days)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue chart data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/dashboard/revenue-chart", getRevenueChartData);

export default router; 