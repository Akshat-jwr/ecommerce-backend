import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const addressSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true
    },
    street: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    postalCode: {
        type: String,
        required: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
});

const cartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    // customizations: {
    //     engravingText: String,
    //     imageUrl: String
    // }

    //I WANT TO KEEP CUSTOMIZATIONS AT CHECKOUT ONLY WHEN ORDER IS PLACED AND NOT IN THE USER'S CART
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    countryCode: {
        type: String,
        default: "+91"
    },
    phone: {
        type: String,
        match: [/^[0-9]{10}$/, "Please enter a valid phone number"]
    },
    password: {
        type: String,
        // Making password optional for Google authenticated users
        required: function() {
            return !this.googleId; // Password required only if no googleId
        }
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    googleId: {
        type: String
    },
    avatar: {
        type: String
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    addresses: [addressSchema],
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    }],
    cart: {
        items: [cartItemSchema],
        totalPrice: {
            type: Number,
            default: 0
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
    }],
    refreshToken: {
        type: String
    }
}, { timestamps: true });


// Pre-save hook to hash password
userSchema.pre("save", async function(next) {
    if (this.isModified("password") && this.password) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare password
userSchema.methods.isPasswordCorrect = async function(password) {
    if (!this.password) return false; // For Google auth users with no password
    return await bcrypt.compare(password, this.password);
};

// Method to generate access token
userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            name: this.name,
            role: this.role
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    );
};

export const User = mongoose.model("User", userSchema); 