import { Product } from "../../models/product.model.js";
import { Category } from "../../models/category.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Create a new product
 * @route POST /api/v1/admin/products
 * @access Admin
 */
export const createProduct = asyncHandler(async (req, res) => {
    const {
        name,
        description,
        price,
        discountPercentage,
        stock,
        category,
        images,
        features,
        specifications,
        customizationOptions
    } = req.body;

    // Check for required fields
    if (!name || !description || !price || !stock || !category) {
        throw new ApiError(400, "All required fields must be provided");
    }

    // Validate category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
        throw new ApiError(400, "Invalid category");
    }

    // Create product
    const product = await Product.create({
        name,
        description,
        price,
        discountPercentage: discountPercentage || 0,
        stock,
        category,
        images: images || [],
        features: features || [],
        specifications: specifications || {},
        customizationOptions: customizationOptions || []
    });

    return res
        .status(201)
        .json(new ApiResponse(201, product, "Product created successfully"));
});

/**
 * Get all products with filtering, pagination and sorting
 * @route GET /api/v1/admin/products
 * @access Admin
 */
export const getAllProducts = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        sort = "createdAt",
        order = "desc",
        search = "",
        category
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter object
    const filter = {};

    // Add search filter if provided
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } }
        ];
    }

    // Add category filter if provided
    if (category) {
        filter.category = category;
    }

    // Count total products matching the filter
    const totalProducts = await Product.countDocuments(filter);

    // Get products with pagination, sorting and filtering
    const products = await Product.find(filter)
        .sort({ [sort]: order === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limitNumber)
        .populate("category", "name");

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                products,
                pagination: {
                    total: totalProducts,
                    page: pageNumber,
                    limit: limitNumber,
                    pages: Math.ceil(totalProducts / limitNumber)
                }
            },
            "Products retrieved successfully"
        )
    );
});

/**
 * Get a product by ID
 * @route GET /api/v1/admin/products/:id
 * @access Admin
 */
export const getProductById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid product ID");
    }

    const product = await Product.findById(id).populate("category", "name");

    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    return res.status(200).json(
        new ApiResponse(200, product, "Product retrieved successfully")
    );
});

/**
 * Update a product
 * @route PUT /api/v1/admin/products/:id
 * @access Admin
 */
export const updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid product ID");
    }

    // If category is provided, validate it exists
    if (updateData.category) {
        const categoryExists = await Category.findById(updateData.category);
        if (!categoryExists) {
            throw new ApiError(400, "Invalid category");
        }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
    ).populate("category", "name");

    if (!updatedProduct) {
        throw new ApiError(404, "Product not found");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedProduct, "Product updated successfully")
    );
});

/**
 * Delete a product
 * @route DELETE /api/v1/admin/products/:id
 * @access Admin
 */
export const deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid product ID");
    }

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
        throw new ApiError(404, "Product not found");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Product deleted successfully")
    );
}); 