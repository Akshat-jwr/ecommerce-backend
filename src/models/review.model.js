import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true
    },
    images: {
        type: [String],
        default: []
    },
    isVerifiedPurchase: {
        type: Boolean,
        default: false
    },

    replies: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        comment: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

// Validate rating range
reviewSchema.path('rating').validate(function(rating) {
    return rating >= 1 && rating <= 5;
}, 'Rating must be between 1 and 5');

// Method to add a reply
reviewSchema.methods.addReply = function(userId, comment) {
    this.replies.push({
        userId,
        comment,
        createdAt: new Date()
    });
};

export const Review = mongoose.model("Review", reviewSchema); 