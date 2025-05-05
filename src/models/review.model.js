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
    userName: {
        type: String,
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
    likes: {
        type: Number,
        default: 0
    },
    dislikes: {
        type: Number,
        default: 0
    },
    replies: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        userName: String,
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
reviewSchema.methods.addReply = function(userId, userName, comment) {
    this.replies.push({
        userId,
        userName,
        comment,
        createdAt: new Date()
    });
};

export const Review = mongoose.model("Review", reviewSchema); 