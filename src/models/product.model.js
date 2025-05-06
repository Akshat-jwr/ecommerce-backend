import mongoose from "mongoose";

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

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    images: {
        type: [imageSchema],
        default: []
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    tags: {
        type: [String],
        default: []
    },
    status: {
        type: String,
        enum: ["Available", "OutOfStock", "Discontinued", "ComingSoon"],
        default: "Available"
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    customizationOptions: {
        engraving: {
            type: Boolean,
            default: false
        },
        photoUpload: {
            type: Boolean,
            default: false
        },
        colorOptions: {
            type: [String],
            default: []
        }
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
}, { timestamps: true });

// Add index for better search performance
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Method to check if product is available for purchase
productSchema.methods.isInStock = function() {
    return this.status === "Available" && this.isAvailable;
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
        this.isAvailable = (this.status === "Available");
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