import { Router } from "express";
import {
  getAllProducts,
  getProductById,
  getFeaturedProducts,
  searchProducts,
  getProductsByCategory,
  getRelatedProducts
} from "../controllers/public/product.controller.js";
import {
  getAllCategories,
  getCategoryById,
  getCategoryProducts
} from "../controllers/public/category.controller.js";
import {
  globalSearch,
  getFilterOptions
} from "../controllers/public/search.controller.js";
import {
  paginationRules,
  isValidObjectId,
  validate
} from "../middlewares/validator.middleware.js";
import { query } from "express-validator";
import { trackProductView, trackSearch } from "../middlewares/activity.middleware.js";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PublicProduct:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: number
 *         discountPercentage:
 *           type: number
 *         discountedPrice:
 *           type: number
 *         stock:
 *           type: number
 *         category:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *         images:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               isFeatured:
 *                 type: boolean
 *         features:
 *           type: array
 *           items:
 *             type: string
 *         specifications:
 *           type: object
 *         averageRating:
 *           type: number
 *         reviewCount:
 *           type: number
 *         isInStock:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     ProductFilters:
 *       type: object
 *       properties:
 *         priceRange:
 *           type: object
 *           properties:
 *             min:
 *               type: number
 *             max:
 *               type: number
 *         categories:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               name:
 *                 type: string
 *               count:
 *                 type: number
 *         brands:
 *           type: array
 *           items:
 *             type: string
 *         stockStatus:
 *           type: array
 *           items:
 *             type: string
 *             enum: [in-stock, out-of-stock]
 */

/**
 * @swagger
 * tags:
 *   - name: Public Products
 *     description: Public product endpoints (no authentication required)
 *   - name: Public Categories  
 *     description: Public category endpoints (no authentication required)
 *   - name: Public Search
 *     description: Public search endpoints (no authentication required)
 */

// Product search validation
const productSearchValidation = [
  query("q").optional().isString().trim().isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),
  query("category").optional().isMongoId().withMessage("Invalid category ID"),
  query("minPrice").optional().isFloat({ min: 0 }).withMessage("Minimum price must be a positive number"),
  query("maxPrice").optional().isFloat({ min: 0 }).withMessage("Maximum price must be a positive number"),
  query("sort").optional().isIn(["price", "name", "rating", "newest", "popularity"])
    .withMessage("Invalid sort option"),
  query("order").optional().isIn(["asc", "desc"]).withMessage("Order must be asc or desc"),
  query("inStock").optional().isBoolean().withMessage("inStock must be a boolean"),
  paginationRules,
  validate
];

// PRODUCT ROUTES

/**
 * @swagger
 * /api/v1/public/products:
 *   get:
 *     summary: Get all products with advanced filtering, sorting, and pagination
 *     tags: [Public Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 12
 *         description: Number of products per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search products by name or description
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Maximum price filter
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [price, name, rating, newest, popularity]
 *           default: newest
 *         description: Sort products by field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *         description: Filter by stock availability
 *     responses:
 *       200:
 *         description: Products retrieved successfully
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
 *                     products:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PublicProduct'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         pages:
 *                           type: number
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 *                 message:
 *                   type: string
 */
router.get("/products", productSearchValidation, getAllProducts);

/**
 * @swagger
 * /api/v1/public/products/featured:
 *   get:
 *     summary: Get featured products
 *     tags: [Public Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 8
 *         description: Number of featured products to return
 *     responses:
 *       200:
 *         description: Featured products retrieved successfully
 */
router.get("/products/featured", 
  query("limit").optional().isInt({ min: 1, max: 20 }).withMessage("Limit must be between 1 and 20"),
  validate,
  getFeaturedProducts
);

/**
 * @swagger
 * /api/v1/public/products/search:
 *   get:
 *     summary: Advanced product search with autocomplete suggestions
 *     tags: [Public Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Search query
 *       - in: query
 *         name: suggestions
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return search suggestions instead of full results
 *     responses:
 *       200:
 *         description: Search results or suggestions
 */
router.get("/products/search", 
  query("q").notEmpty().trim().isLength({ min: 1, max: 100 })
    .withMessage("Search query is required and must be between 1-100 characters"),
  query("suggestions").optional().isBoolean().withMessage("Suggestions must be a boolean"),
  productSearchValidation,
  trackSearch,
  searchProducts
);

/**
 * @swagger
 * /api/v1/public/products/category/{categoryId}:
 *   get:
 *     summary: Get products by category
 *     tags: [Public Products]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [price, name, rating, newest]
 *     responses:
 *       200:
 *         description: Category products retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get("/products/category/:categoryId", 
  isValidObjectId("categoryId"),
  productSearchValidation,
  getProductsByCategory
);

/**
 * @swagger
 * /api/v1/public/products/{id}:
 *   get:
 *     summary: Get single product details
 *     tags: [Public Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get("/products/:id", 
  isValidObjectId("id"),
  validate,
  trackProductView,
  getProductById
);

/**
 * @swagger
 * /api/v1/public/products/{id}/related:
 *   get:
 *     summary: Get related products
 *     tags: [Public Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           default: 6
 *         description: Number of related products
 *     responses:
 *       200:
 *         description: Related products retrieved successfully
 */
router.get("/products/:id/related", 
  isValidObjectId("id"),
  query("limit").optional().isInt({ min: 1, max: 12 }).withMessage("Limit must be between 1 and 12"),
  validate,
  getRelatedProducts
);

// CATEGORY ROUTES

/**
 * @swagger
 * /api/v1/public/categories:
 *   get:
 *     summary: Get all categories in hierarchical structure
 *     tags: [Public Categories]
 *     parameters:
 *       - in: query
 *         name: includeEmpty
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include categories with no products
 *       - in: query
 *         name: parentOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return only parent categories
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get("/categories", 
  query("includeEmpty").optional().isBoolean().withMessage("includeEmpty must be a boolean"),
  query("parentOnly").optional().isBoolean().withMessage("parentOnly must be a boolean"),
  validate,
  getAllCategories
);

/**
 * @swagger
 * /api/v1/public/categories/{id}:
 *   get:
 *     summary: Get single category details
 *     tags: [Public Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category details retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get("/categories/:id", 
  isValidObjectId("id"),
  validate,
  getCategoryById
);

/**
 * @swagger
 * /api/v1/public/categories/{id}/products:
 *   get:
 *     summary: Get products in a specific category (alternative to /products/category/:id)
 *     tags: [Public Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category products retrieved successfully
 */
router.get("/categories/:id/products", 
  isValidObjectId("id"),
  productSearchValidation,
  getCategoryProducts
);

// SEARCH & FILTER ROUTES

/**
 * @swagger
 * /api/v1/public/search:
 *   get:
 *     summary: Global search across products and categories
 *     tags: [Public Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, products, categories]
 *           default: all
 *         description: Type of results to return
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 */
router.get("/search", 
  query("q").notEmpty().trim().isLength({ min: 1, max: 100 })
    .withMessage("Search query is required and must be between 1-100 characters"),
  query("type").optional().isIn(["all", "products", "categories"])
    .withMessage("Type must be all, products, or categories"),
  validate,
  trackSearch,
  globalSearch
);

/**
 * @swagger
 * /api/v1/public/filters:
 *   get:
 *     summary: Get available filter options for products
 *     tags: [Public Search]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Get filters specific to a category
 *     responses:
 *       200:
 *         description: Filter options retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ProductFilters'
 */
router.get("/filters", 
  query("category").optional().isMongoId().withMessage("Invalid category ID"),
  validate,
  getFilterOptions
);

export default router;
