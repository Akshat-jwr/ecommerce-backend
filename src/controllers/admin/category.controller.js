import { Category } from "../../models/category.model.js";
import { Product } from "../../models/product.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Create a new category
 * @route POST /api/v1/admin/categories
 * @access Admin
 */
export const createCategory = asyncHandler(async (req, res) => {
    const { name, description, parentCategory } = req.body;

    if (!name) {
        throw new ApiError(400, "Category name is required");
    }

    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
    if (existingCategory) {
        throw new ApiError(409, "Category with this name already exists");
    }

    // If parentCategory is provided, validate it exists
    if (parentCategory) {
        const parentExists = await Category.findById(parentCategory);
        if (!parentExists) {
            throw new ApiError(400, "Invalid parent category");
        }
    }

    // Create category
    const category = await Category.create({
        name,
        description,
        parentCategory: parentCategory || null
    });

    return res
        .status(201)
        .json(new ApiResponse(201, category, "Category created successfully"));
});

/**
 * Get all categories
 * @route GET /api/v1/admin/categories
 * @access Admin
 */
export const getAllCategories = asyncHandler(async (req, res) => {
    const { parentOnly, childrenOf } = req.query;
    
    let filter = {};
    
    // Filter parent categories only
    if (parentOnly === "true") {
        filter.parentCategory = null;
    }
    
    // Filter children of a specific category
    if (childrenOf) {
        if (!mongoose.Types.ObjectId.isValid(childrenOf)) {
            throw new ApiError(400, "Invalid parent category ID");
        }
        filter.parentCategory = childrenOf;
    }
    
    const categories = await Category.find(filter)
        .populate("parentCategory", "name");
        
    return res.status(200).json(
        new ApiResponse(200, categories, "Categories retrieved successfully")
    );
});

/**
 * Get a category by ID
 * @route GET /api/v1/admin/categories/:id
 * @access Admin
 */
export const getCategoryById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid category ID");
    }
    
    const category = await Category.findById(id)
        .populate("parentCategory", "name");
        
    if (!category) {
        throw new ApiError(404, "Category not found");
    }
    
    return res.status(200).json(
        new ApiResponse(200, category, "Category retrieved successfully")
    );
});

/**
 * Update a category
 * @route PUT /api/v1/admin/categories/:id
 * @access Admin
 */
export const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, parentCategory } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid category ID");
    }
    
    const category = await Category.findById(id);
    if (!category) {
        throw new ApiError(404, "Category not found");
    }
    
    // Check if name is being updated and if it already exists
    if (name && name !== category.name) {
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, "i") },
            _id: { $ne: id } 
        });
        
        if (existingCategory) {
            throw new ApiError(409, "Category with this name already exists");
        }
    }
    
    // If parentCategory is provided, validate it exists and is not the category itself
    if (parentCategory) {
        if (parentCategory === id) {
            throw new ApiError(400, "Category cannot be its own parent");
        }
        
        const parentExists = await Category.findById(parentCategory);
        if (!parentExists) {
            throw new ApiError(400, "Invalid parent category");
        }
        
        // Check for circular reference
        let currentParent = parentExists;
        while (currentParent && currentParent.parentCategory) {
            if (currentParent.parentCategory.toString() === id) {
                throw new ApiError(400, "Circular parent-child relationship detected");
            }
            currentParent = await Category.findById(currentParent.parentCategory);
        }
    }
    
    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
        id,
        {
            name: name || category.name,
            description: description !== undefined ? description : category.description,
            parentCategory: parentCategory !== undefined ? parentCategory : category.parentCategory
        },
        { new: true, runValidators: true }
    ).populate("parentCategory", "name");
    
    return res.status(200).json(
        new ApiResponse(200, updatedCategory, "Category updated successfully")
    );
});

/**
 * Delete a category
 * @route DELETE /api/v1/admin/categories/:id
 * @access Admin
 */
export const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid category ID");
    }
    
    // Check if category exists
    const category = await Category.findById(id);
    if (!category) {
        throw new ApiError(404, "Category not found");
    }
    
    // Check if category has children
    const hasChildren = await Category.exists({ parentCategory: id });
    if (hasChildren) {
        throw new ApiError(400, "Cannot delete category with child categories");
    }
    
    // Check if products are using this category
    const hasProducts = await Product.exists({ category: id });
    if (hasProducts) {
        throw new ApiError(400, "Cannot delete category with associated products");
    }
    
    // Delete category
    await Category.findByIdAndDelete(id);
    
    return res.status(200).json(
        new ApiResponse(200, {}, "Category deleted successfully")
    );
}); 