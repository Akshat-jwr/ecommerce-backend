import mongoose from "mongoose";
import { PRODUCT_STATUS } from "../constants/index.js";

const imageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    publicId: {
        type: String,
        required: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true,
            index: true
        },
        description: {
            type: String,
            required: [true, "Product description is required"],
            trim: true
        },
        price: {
            type: Number,
            required: [true, "Product price is required"],
            min: [0, "Price cannot be negative"]
        },
        discountPercentage: {
            type: Number,
            default: 0,
            min: [0, "Discount cannot be negative"],
            max: [100, "Discount cannot exceed 100%"]
        },
        stock: {
            type: Number,
            required: [true, "Product stock is required"],
            min: [0, "Stock cannot be negative"],
            default: 0
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: [true, "Product category is required"]
        },
        images: {
            type: [String],
            default: []
        },
        features: {
            type: [String],
            default: []
        },
        specifications: {
            type: Object,
            default: {}
        },
        customizationOptions: {
            type: [{
                name: String,
                options: [String]
            }],
            default: []
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        numReviews: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: Object.values(PRODUCT_STATUS),
            default: PRODUCT_STATUS.AVAILABLE
        },
        isAvailable: {
            type: Boolean,
            default: true
        },
        ratings: {
            average: {
                type: Number,
                default: 0,
                min: 0,
                max: 5
            },
            count: {
                type: Number,
                default: 0
            }
        },
        reviews: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Review"
        }],
        featured: {
            type: Boolean,
            default: false
        },
        seo: {
            title: String,
            description: String,
            keywords: [String]
        }
    },
    { timestamps: true }
);

// Add text index for search functionality
productSchema.index(
    { name: "text", description: "text" },
    { weights: { name: 3, description: 1 } }
);

// Virtual for calculating sale price
productSchema.virtual("salePrice").get(function() {
    if (!this.discountPercentage) return this.price;
    return this.price * (1 - this.discountPercentage / 100);
});

// Method to check if product is in stock
productSchema.methods.isInStock = function() {
    return this.stock > 0;
};

// When converting to JSON or object, include virtuals
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

// Method to check if product is available for purchase
productSchema.methods.isInStock = function() {
    return this.status === PRODUCT_STATUS.AVAILABLE && this.isAvailable;
};

// Helper method to get featured image
productSchema.methods.getFeaturedImage = function() {
    const featuredImage = this.images.find(img => img.isFeatured);
    return featuredImage ? featuredImage.url : (this.images.length > 0 ? this.images[0].url : null);
};

// Method to update average rating
productSchema.methods.updateRating = function(newRating) {
    const currentTotal = this.ratings.average * this.ratings.count;
    this.ratings.count += 1;
    this.ratings.average = (currentTotal + newRating) / this.ratings.count;
};

// Pre-save hook to update isAvailable based on status
productSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        this.isAvailable = (this.status === PRODUCT_STATUS.AVAILABLE);
    }
    next();
});

// Middleware to clean up Cloudinary images when product is deleted
productSchema.pre('deleteOne', { document: true }, async function(next) {
    try {
        if (this.images && this.images.length > 0) {
            const { deleteFromCloudinary } = await import('../utils/cloudinary.js');
            
            // Delete all images from Cloudinary
            const deletePromises = this.images.map(image => 
                deleteFromCloudinary(image.publicId)
            );
            
            await Promise.all(deletePromises);
        }
        next();
    } catch (error) {
        console.error("Error deleting product images from Cloudinary:", error);
        next(error);
    }
});

export const Product = mongoose.model("Product", productSchema); 