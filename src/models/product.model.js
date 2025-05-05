import mongoose from "mongoose";

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
        type: [String],
        default: []
    },
    category: {
        type: String,
        required: true
    },
    tags: {
        type: [String],
        default: []
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
    }]
}, { timestamps: true });

// Method to check if product is in stock
productSchema.methods.isInStock = function() {
    return this.isAvailable;
};

// Method to update average rating
productSchema.methods.updateRating = function(newRating) {
    const currentTotal = this.ratings.average * this.ratings.count;
    this.ratings.count += 1;
    this.ratings.average = (currentTotal + newRating) / this.ratings.count;
};

export const Product = mongoose.model("Product", productSchema); 