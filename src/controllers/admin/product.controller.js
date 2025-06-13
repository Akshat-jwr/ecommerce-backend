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
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const {
        name,
        description,
        shortDescription,
        price,
        cost,
        stock,
        category,
        subCategory,
        brand,
        tags,
        features,
        specifications,
        customizationOptions,
        discounts,
        seo,
        variants,
        weight,
        dimensions,
        shippingClass,
        isDigital,
        isFeatured,
        lowStockThreshold
      } = req.body;

      // Validate required fields
      if (!name || !description || !price || stock === undefined || !category) {
        if (req.files) cleanupTempFiles(req.files);
        throw new ApiError(400, "Required fields: name, description, price, stock, category");
      }

      // Validate numeric fields
      const numericPrice = parseFloat(price);
      const numericStock = parseInt(stock);
      const numericCost = cost ? parseFloat(cost) : 0;

      if (isNaN(numericPrice) || numericPrice < 0) {
        if (req.files) cleanupTempFiles(req.files);
        throw new ApiError(400, "Price must be a valid positive number");
      }

      if (isNaN(numericStock) || numericStock < 0) {
        if (req.files) cleanupTempFiles(req.files);
        throw new ApiError(400, "Stock must be a valid non-negative number");
      }

      // Validate category exists
      const categoryExists = await Category.findById(category).session(session);
      if (!categoryExists) {
        if (req.files) cleanupTempFiles(req.files);
        throw new ApiError(400, "Invalid category");
      }

      // Validate subcategory if provided
      if (subCategory) {
        const subCategoryExists = await Category.findById(subCategory).session(session);
        if (!subCategoryExists) {
          if (req.files) cleanupTempFiles(req.files);
          throw new ApiError(400, "Invalid subcategory");
        }
      }

      // Process images
      let processedImages = [];
      if (req.files && req.files.length > 0) {
        console.log(`Processing ${req.files.length} images for new product`);
        
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          try {
            const cloudinaryResponse = await uploadOnCloudinary(file.path, "products");
            
            if (cloudinaryResponse) {
              processedImages.push({
                url: cloudinaryResponse.secure_url,
                publicId: cloudinaryResponse.public_id,
                isFeatured: i === 0, // First image is featured
                alt: `${name} - Image ${i + 1}`,
                width: cloudinaryResponse.width || null,
                height: cloudinaryResponse.height || null,
                size: cloudinaryResponse.bytes || null,
                format: cloudinaryResponse.format || null
              });
            }
          } catch (error) {
            console.error(`Failed to upload image ${file.path}:`, error);
          }
        }
        
        console.log(`Successfully processed ${processedImages.length} images`);
      }

      // Process JSON fields safely
      const parseJsonField = (field, fieldName) => {
        if (!field) return [];
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch (e) {
            throw new ApiError(400, `Invalid JSON format for ${fieldName}`);
          }
        }
        return Array.isArray(field) ? field : [];
      };

      const parseJsonObject = (field, fieldName) => {
        if (!field) return {};
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch (e) {
            throw new ApiError(400, `Invalid JSON format for ${fieldName}`);
          }
        }
        return typeof field === 'object' ? field : {};
      };

      // Process discounts with validation
      let processedDiscounts = [];
      if (discounts) {
        const discountData = parseJsonField(discounts, 'discounts');
        processedDiscounts = discountData.map(discount => {
          // Validate discount
          if (discount.type === 'percentage' && (discount.value < 0 || discount.value > 100)) {
            throw new ApiError(400, "Percentage discount must be between 0 and 100");
          }
          if (discount.type === 'fixed' && discount.value < 0) {
            throw new ApiError(400, "Fixed discount must be non-negative");
          }

          return {
            ...discount,
            startDate: discount.startDate ? new Date(discount.startDate) : undefined,
            endDate: discount.endDate ? new Date(discount.endDate) : undefined
          };
        });
      }

      // Process variants
      let processedVariants = [];
      if (variants) {
        const variantData = parseJsonField(variants, 'variants');
        processedVariants = variantData.map(variant => ({
          ...variant,
          sku: variant.sku || `${name.replace(/\s+/g, '-').toLowerCase()}-${variant.name || 'variant'}-${Date.now()}`
        }));
      }

      // Create SEO slug
      const baseSlug = (seo?.slug || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Ensure slug uniqueness
      let finalSlug = baseSlug;
      let counter = 1;
      while (await Product.findOne({ 'seo.slug': finalSlug }).session(session)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Build product data
      const productData = {
        name: name.trim(),
        description: description.trim(),
        shortDescription: shortDescription?.trim() || '',
        price: numericPrice,
        cost: numericCost,
        stock: numericStock,
        lowStockThreshold: lowStockThreshold ? parseInt(lowStockThreshold) : 10,
        category,
        subCategory: subCategory || null,
        brand: brand?.trim() || '',
        tags: parseJsonField(tags, 'tags'),
        images: processedImages,
        features: parseJsonField(features, 'features'),
        specifications: parseJsonObject(specifications, 'specifications'),
        customizationOptions: parseJsonField(customizationOptions, 'customizationOptions'),
        discounts: processedDiscounts,
        hasVariants: processedVariants.length > 0,
        variants: processedVariants,
        weight: weight ? parseFloat(weight) : null,
        dimensions: parseJsonObject(dimensions, 'dimensions'),
        shippingClass: shippingClass?.trim() || '',
        isDigital: isDigital === 'true' || isDigital === true,
        isFeatured: isFeatured === 'true' || isFeatured === true,
        seo: {
          slug: finalSlug,
          metaTitle: seo?.metaTitle || name,
          metaDescription: seo?.metaDescription || shortDescription || description.substring(0, 160),
          keywords: parseJsonField(seo?.keywords, 'seo.keywords'),
          canonicalUrl: seo?.canonicalUrl || ''
        },
        status: 'active',
        createdBy: req.user._id
      };

      const [product] = await Product.create([productData], { session });

      return res.status(201).json(
        new ApiResponse(201, product, "Product created successfully")
      );
    });
  } catch (error) {
    if (req.files) cleanupTempFiles(req.files);
    throw error;
  } finally {
    await session.endSession();
  }
});

/**
 * Get all products with filtering and pagination
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
    category,
    subCategory,
    brand,
    status,
    minPrice,
    maxPrice,
    inStock,
    isFeatured,
    tags
  } = req.query;

  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(Math.max(1, parseInt(limit)), 100);
  const skip = (pageNumber - 1) * limitNumber;

  // Build filter object
  const filter = {};

  // Text search
  if (search.trim()) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } }
    ];
  }

  // Filters
  if (category) filter.category = category;
  if (subCategory) filter.subCategory = subCategory;
  if (brand) filter.brand = { $regex: brand, $options: "i" };
  if (status) filter.status = status;
  if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';

  // Price range
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
  }

  // Stock filter
  if (inStock !== undefined) {
    filter.stock = inStock === 'true' ? { $gt: 0 } : { $eq: 0 };
  }

  // Tags filter
  if (tags) {
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    if (tagArray.length > 0) {
      filter.tags = { $in: tagArray };
    }
  }

  // Build sort object
  const validSortFields = ['name', 'price', 'stock', 'createdAt', 'updatedAt', 'averageRating'];
  const sortField = validSortFields.includes(sort) ? sort : 'createdAt';
  const sortOrder = order === 'asc' ? 1 : -1;

  try {
    // Get total count
    const totalProducts = await Product.countDocuments(filter);

    // Get products
    const products = await Product.find(filter)
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    // Add computed fields
    const enrichedProducts = products.map(product => {
      const activeDiscount = getActiveDiscount(product);
      const currentPrice = calculateCurrentPrice(product, activeDiscount);
      
      return {
        ...product,
        currentPrice,
        savings: product.price - currentPrice,
        discountPercentage: product.price > 0 ? Math.round(((product.price - currentPrice) / product.price) * 100) : 0,
        isInStock: product.stock > 0,
        isLowStock: product.stock <= (product.lowStockThreshold || 10) && product.stock > 0,
        featuredImage: product.images?.find(img => img.isFeatured) || product.images?.[0]
      };
    });

    const pagination = {
      total: totalProducts,
      page: pageNumber,
      limit: limitNumber,
      pages: Math.ceil(totalProducts / limitNumber),
      hasNext: pageNumber < Math.ceil(totalProducts / limitNumber),
      hasPrev: pageNumber > 1
    };

    return res.status(200).json(
      new ApiResponse(200, { products: enrichedProducts, pagination }, "Products retrieved successfully")
    );
  } catch (error) {
    throw new ApiError(500, "Error retrieving products");
  }
});

/**
 * Get product by ID
 * @route GET /api/v1/admin/products/:id
 * @access Admin
 */
export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product ID");
  }

  const product = await Product.findById(id)
    .populate("category", "name description")
    .populate("subCategory", "name description")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  // Add computed fields
  const activeDiscount = getActiveDiscount(product);
  const currentPrice = calculateCurrentPrice(product, activeDiscount);
  
  const enrichedProduct = {
    ...product,
    currentPrice,
    savings: product.price - currentPrice,
    discountPercentage: product.price > 0 ? Math.round(((product.price - currentPrice) / product.price) * 100) : 0,
    isInStock: product.stock > 0,
    isLowStock: product.stock <= (product.lowStockThreshold || 10) && product.stock > 0,
    featuredImage: product.images?.find(img => img.isFeatured) || product.images?.[0]
  };

  return res.status(200).json(
    new ApiResponse(200, enrichedProduct, "Product retrieved successfully")
  );
});

/**
 * Update product
 * @route PUT /api/v1/admin/products/:id
 * @access Admin
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.files) cleanupTempFiles(req.files);
        throw new ApiError(400, "Invalid product ID");
      }

      // Get existing product
      const existingProduct = await Product.findById(id).session(session);
      if (!existingProduct) {
        if (req.files) cleanupTempFiles(req.files);
        throw new ApiError(404, "Product not found");
      }

      const updateData = { ...req.body };

      // Validate category if provided
      if (updateData.category && updateData.category !== existingProduct.category.toString()) {
        const categoryExists = await Category.findById(updateData.category).session(session);
        if (!categoryExists) {
          if (req.files) cleanupTempFiles(req.files);
          throw new ApiError(400, "Invalid category");
        }
      }

      // Validate numeric fields
      if (updateData.price !== undefined) {
        const numericPrice = parseFloat(updateData.price);
        if (isNaN(numericPrice) || numericPrice < 0) {
          if (req.files) cleanupTempFiles(req.files);
          throw new ApiError(400, "Price must be a valid positive number");
        }
        updateData.price = numericPrice;
      }

      if (updateData.stock !== undefined) {
        const numericStock = parseInt(updateData.stock);
        if (isNaN(numericStock) || numericStock < 0) {
          if (req.files) cleanupTempFiles(req.files);
          throw new ApiError(400, "Stock must be a valid non-negative number");
        }
        updateData.stock = numericStock;
      }

      // Parse JSON fields safely
      const jsonFields = ['features', 'specifications', 'customizationOptions', 'discounts', 'variants', 'dimensions', 'seo', 'tags'];
      jsonFields.forEach(field => {
        if (updateData[field] && typeof updateData[field] === 'string') {
          try {
            updateData[field] = JSON.parse(updateData[field]);
          } catch (e) {
            throw new ApiError(400, `Invalid JSON format for ${field}`);
          }
        }
      });

      // Handle image updates
      if (req.files && req.files.length > 0) {
        console.log(`Processing ${req.files.length} new images for product update`);

        const newImages = [];
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          try {
            const cloudinaryResponse = await uploadOnCloudinary(file.path, "products");
            
            if (cloudinaryResponse) {
              newImages.push({
                url: cloudinaryResponse.secure_url,
                publicId: cloudinaryResponse.public_id,
                isFeatured: false,
                alt: `${updateData.name || existingProduct.name} - Image ${i + 1}`,
                width: cloudinaryResponse.width || null,
                height: cloudinaryResponse.height || null,
                size: cloudinaryResponse.bytes || null,
                format: cloudinaryResponse.format || null
              });
            }
          } catch (error) {
            console.error(`Failed to upload image ${file.path}:`, error);
          }
        }

        // Handle image strategy
        const imageStrategy = updateData.imageStrategy || 'replace';
        
        if (imageStrategy === 'replace' && newImages.length > 0) {
          // Delete old images
          for (const oldImage of existingProduct.images) {
            if (oldImage.publicId) {
              try {
                await deleteFromCloudinary(oldImage.publicId);
              } catch (error) {
                console.error(`Failed to delete image ${oldImage.publicId}:`, error);
              }
            }
          }
          updateData.images = newImages;
          if (newImages.length > 0) {
            newImages[0].isFeatured = true;
          }
        } else if (imageStrategy === 'append') {
          updateData.images = [...existingProduct.images, ...newImages];
        }

        console.log(`Successfully processed ${newImages.length} new images`);
      }

      // Handle image removals
      if (updateData.imagesToRemove) {
        const imagesToRemove = Array.isArray(updateData.imagesToRemove) 
          ? updateData.imagesToRemove 
          : JSON.parse(updateData.imagesToRemove);

        const currentImages = updateData.images || existingProduct.images;
        const updatedImages = [];

        for (let i = 0; i < currentImages.length; i++) {
          if (imagesToRemove.includes(i.toString()) || imagesToRemove.includes(i)) {
            // Delete from Cloudinary
            if (currentImages[i].publicId) {
              try {
                await deleteFromCloudinary(currentImages[i].publicId);
              } catch (error) {
                console.error(`Failed to delete image ${currentImages[i].publicId}:`, error);
              }
            }
          } else {
            updatedImages.push(currentImages[i]);
          }
        }

        updateData.images = updatedImages;
        delete updateData.imagesToRemove;
      }

      // Process discounts with validation
      if (updateData.discounts) {
        updateData.discounts = updateData.discounts.map(discount => {
          if (discount.type === 'percentage' && (discount.value < 0 || discount.value > 100)) {
            throw new ApiError(400, "Percentage discount must be between 0 and 100");
          }
          if (discount.type === 'fixed' && discount.value < 0) {
            throw new ApiError(400, "Fixed discount must be non-negative");
          }

          return {
            ...discount,
            startDate: discount.startDate ? new Date(discount.startDate) : undefined,
            endDate: discount.endDate ? new Date(discount.endDate) : undefined
          };
        });
      }

      // Handle variants
      if (updateData.variants) {
        updateData.hasVariants = updateData.variants.length > 0;
        updateData.variants = updateData.variants.map(variant => ({
          ...variant,
          sku: variant.sku || `${(updateData.name || existingProduct.name).replace(/\s+/g, '-').toLowerCase()}-${variant.name || 'variant'}-${Date.now()}`
        }));
      }

      // Update SEO slug if name changed
      if (updateData.name && updateData.name !== existingProduct.name) {
        const baseSlug = updateData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        let finalSlug = baseSlug;
        let counter = 1;
        while (await Product.findOne({ 
          'seo.slug': finalSlug,
          _id: { $ne: id }
        }).session(session)) {
          finalSlug = `${baseSlug}-${counter}`;
          counter++;
        }

        updateData.seo = {
          ...existingProduct.seo,
          ...updateData.seo,
          slug: finalSlug
        };
      }

      // Ensure at least one featured image
      if (updateData.images && updateData.images.length > 0) {
        const hasFeatured = updateData.images.some(img => img.isFeatured);
        if (!hasFeatured) {
          updateData.images[0].isFeatured = true;
        }
      }

      // Clean up strategy fields
      delete updateData.imageStrategy;
      delete updateData.keepExistingImages;

      // Set updatedBy
      updateData.updatedBy = req.user._id;
      updateData.updatedAt = new Date();

      // Update product
      const updatedProduct = await Product.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true, session }
      )
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("updatedBy", "name email");

      return res.status(200).json(
        new ApiResponse(200, updatedProduct, "Product updated successfully")
      );
    });
  } catch (error) {
    if (req.files) cleanupTempFiles(req.files);
    throw error;
  } finally {
    await session.endSession();
  }
});

/**
 * Delete product
 * @route DELETE /api/v1/admin/products/:id
 * @access Admin
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid product ID");
      }

      const product = await Product.findById(id).session(session);
      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      // Delete images from Cloudinary
      if (product.images && product.images.length > 0) {
        for (const image of product.images) {
          if (image.publicId) {
            try {
              await deleteFromCloudinary(image.publicId);
            } catch (error) {
              console.error(`Failed to delete image ${image.publicId}:`, error);
            }
          }
        }
      }

      // Delete videos from Cloudinary
      if (product.videos && product.videos.length > 0) {
        for (const video of product.videos) {
          if (video.publicId) {
            try {
              await deleteFromCloudinary(video.publicId);
            } catch (error) {
              console.error(`Failed to delete video ${video.publicId}:`, error);
            }
          }
        }
      }

      // Delete the product
      await Product.findByIdAndDelete(id).session(session);

      return res.status(200).json(
        new ApiResponse(200, {}, "Product deleted successfully")
      );
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Bulk update products
 * @route PATCH /api/v1/admin/products/bulk-update
 * @access Admin
 */
export const bulkUpdateProducts = asyncHandler(async (req, res) => {
  const { productIds, updateData } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    throw new ApiError(400, "Product IDs array is required");
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    throw new ApiError(400, "Update data is required");
  }

  // Validate all product IDs
  const validIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length !== productIds.length) {
    throw new ApiError(400, "Some product IDs are invalid");
  }

  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const result = await Product.updateMany(
        { _id: { $in: validIds } },
        { 
          ...updateData,
          updatedBy: req.user._id,
          updatedAt: new Date()
        },
        { session }
      );

      return res.status(200).json(
        new ApiResponse(200, {
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount
        }, "Products updated successfully")
      );
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Get low stock products
 * @route GET /api/v1/admin/products/low-stock
 * @access Admin
 */
export const getLowStockProducts = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const products = await Product.find({
    $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    status: "active"
  })
    .populate("category", "name")
    .select("name stock lowStockThreshold price images")
    .sort({ stock: 1 })
    .limit(parseInt(limit))
    .lean();

  return res.status(200).json(
    new ApiResponse(200, products, "Low stock products retrieved successfully")
  );
});

// Helper functions
function getActiveDiscount(product, quantity = 1) {
  if (!product.discounts || product.discounts.length === 0) return null;
  
  const now = new Date();
  
  const activeDiscounts = product.discounts.filter(discount => {
    if (!discount.isActive) return false;
    if (discount.startDate && discount.startDate > now) return false;
    if (discount.endDate && discount.endDate < now) return false;
    if (discount.minQuantity && quantity < discount.minQuantity) return false;
    if (discount.maxQuantity && quantity > discount.maxQuantity) return false;
    
    return true;
  });
  
  return activeDiscounts.reduce((best, current) => {
    const currentValue = calculateDiscountValue(product, current, quantity);
    const bestValue = best ? calculateDiscountValue(product, best, quantity) : 0;
    return currentValue > bestValue ? current : best;
  }, null);
}

function calculateDiscountValue(product, discount, quantity = 1) {
  switch (discount.type) {
    case 'percentage':
      return product.price * quantity * (discount.value / 100);
    case 'fixed':
      return discount.value * quantity;
    default:
      return 0;
  }
}

function calculateCurrentPrice(product, activeDiscount = null) {
  if (!activeDiscount) return product.price;
  
  if (activeDiscount.type === 'percentage') {
    return product.price * (1 - activeDiscount.value / 100);
  } else if (activeDiscount.type === 'fixed') {
    return Math.max(0, product.price - activeDiscount.value);
  }
  
  return product.price;
}
