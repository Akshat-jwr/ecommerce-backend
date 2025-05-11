import { Product } from "../../models/product.model.js";
import { Category } from "../../models/category.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary, cleanupTempFiles } from "../../utils/cloudinary.js";
import mongoose from "mongoose";

/**
 * Create a new product
 * @route POST /api/v1/admin/products
 * @access Admin
 */
export const createProduct = asyncHandler(async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            discountPercentage,
            stock,
            category,
            features,
            specifications,
            customizationOptions
        } = req.body;

        // Check for required fields
        if (!name || !description || !price || !stock || !category) {
            // Clean up uploaded files if validation fails
            cleanupTempFiles(req.files);
            throw new ApiError(400, "All required fields must be provided");
        }

        // Validate category exists
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            // Clean up uploaded files if validation fails
            cleanupTempFiles(req.files);
            throw new ApiError(400, "Invalid category");
        }
        
        // Handle image uploads if files are present
        let imageUrls = [];
        
        if (req.files && req.files.length > 0) {
            console.log(`Processing ${req.files.length} image uploads for new product`);
            // Upload each image to Cloudinary
            const uploadPromises = req.files.map(async (file) => {
                const cloudinaryResponse = await uploadOnCloudinary(file.path, "products");
                if (!cloudinaryResponse) {
                    console.error(`Failed to upload image ${file.path} to Cloudinary`);
                    return null;
                }
                return {
                    url: cloudinaryResponse.secure_url,
                    publicId: cloudinaryResponse.public_id
                };
            });
            
            // Wait for all uploads to complete
            const results = await Promise.all(uploadPromises);
            
            // Filter out any failed uploads
            imageUrls = results.filter(result => result !== null);
            console.log(`Successfully uploaded ${imageUrls.length} of ${req.files.length} images`);
        }

        // Create product
        const product = await Product.create({
            name,
            description,
            price,
            discountPercentage: discountPercentage || 0,
            stock,
            category,
            images: imageUrls,
            features: features ? JSON.parse(features) : [],
            specifications: specifications ? JSON.parse(specifications) : {},
            customizationOptions: customizationOptions ? JSON.parse(customizationOptions) : []
        });

        return res
            .status(201)
            .json(new ApiResponse(201, product, "Product created successfully"));
    } catch (error) {
        // Ensure all temporary files are cleaned up in case of any error
        cleanupTempFiles(req.files);
        throw error;
    }
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
    try {
        const { id } = req.params;
        const updateData = {...req.body};

        if (!mongoose.Types.ObjectId.isValid(id)) {
            cleanupTempFiles(req.files);
            throw new ApiError(400, "Invalid product ID");
        }
        
        // Get the current product to check for existing images
        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            cleanupTempFiles(req.files);
            throw new ApiError(404, "Product not found");
        }

        // If category is provided, validate it exists
        if (updateData.category) {
            const categoryExists = await Category.findById(updateData.category);
            if (!categoryExists) {
                cleanupTempFiles(req.files);
                throw new ApiError(400, "Invalid category");
            }
        }
        
        // Parse JSON fields if they are strings
        if (typeof updateData.features === 'string') {
            updateData.features = JSON.parse(updateData.features);
        }
        
        if (typeof updateData.specifications === 'string') {
            updateData.specifications = JSON.parse(updateData.specifications);
        }
        
        if (typeof updateData.customizationOptions === 'string') {
            updateData.customizationOptions = JSON.parse(updateData.customizationOptions);
        }
        
        // Handle image uploads if files are present
        if (req.files && req.files.length > 0) {
            console.log(`Processing ${req.files.length} image uploads for product update (ID: ${id})`);
            // Upload each new image to Cloudinary
            const uploadPromises = req.files.map(async (file) => {
                const cloudinaryResponse = await uploadOnCloudinary(file.path, "products");
                if (!cloudinaryResponse) {
                    console.error(`Failed to upload image ${file.path} to Cloudinary during product update`);
                    return null;
                }
                return {
                    url: cloudinaryResponse.secure_url,
                    publicId: cloudinaryResponse.public_id
                };
            });
            
            // Wait for all uploads to complete
            const results = await Promise.all(uploadPromises);
            
            // Filter out any failed uploads
            const newImages = results.filter(result => result !== null);
            console.log(`Successfully uploaded ${newImages.length} of ${req.files.length} images for product update`);
            
            // Combine existing images with new ones if not replacing all images
            if (updateData.keepExistingImages === 'true') {
                updateData.images = [...existingProduct.images, ...newImages];
            } else {
                // Delete old images from Cloudinary
                existingProduct.images.forEach(async (image) => {
                    if (image.publicId) {
                        await deleteFromCloudinary(image.publicId);
                    }
                });
                
                updateData.images = newImages;
            }
        }
        
        // If there's a request to remove specific images
        if (updateData.imagesToRemove) {
            let imagesToRemove;
            
            try {
                imagesToRemove = JSON.parse(updateData.imagesToRemove);
            } catch (error) {
                cleanupTempFiles(req.files);
                throw new ApiError(400, "Invalid format for imagesToRemove");
            }
            
            // Filter out images that should be removed
            updateData.images = existingProduct.images.filter((image, index) => {
                const shouldRemove = imagesToRemove.includes(index.toString()) || 
                                    imagesToRemove.includes(index);
                
                // Delete image from Cloudinary if it should be removed
                if (shouldRemove && image.publicId) {
                    deleteFromCloudinary(image.publicId).catch(err => 
                        console.error("Error deleting image from Cloudinary:", err)
                    );
                }
                
                return !shouldRemove;
            });
            
            // Remove the imagesToRemove field as it's not part of the model
            delete updateData.imagesToRemove;
        }
        
        // Remove keepExistingImages field as it's not part of the model
        delete updateData.keepExistingImages;

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate("category", "name");

        return res.status(200).json(
            new ApiResponse(200, updatedProduct, "Product updated successfully")
        );
    } catch (error) {
        // Ensure all temporary files are cleaned up in case of any error
        cleanupTempFiles(req.files);
        throw error;
    }
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

    const product = await Product.findById(id);
    
    if (!product) {
        throw new ApiError(404, "Product not found");
    }
    
    // Delete product images from Cloudinary
    if (product.images && product.images.length > 0) {
        product.images.forEach(async (image) => {
            if (image.publicId) {
                await deleteFromCloudinary(image.publicId);
            }
        });
    }
    
    // Delete the product from the database
    await product.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, {}, "Product deleted successfully")
    );
}); 