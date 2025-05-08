import { User, OTP } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateOTP, sendOTPEmail, sendWelcomeEmail } from "../utils/emailService.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js";

/**
 * Generate access and refresh tokens
 * @param {Object} user - User document
 * @returns {Object} - Object containing tokens
 */
const generateTokens = async (user) => {
    try {
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        
        // Save refresh token to user document
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Error generating tokens");
    }
};

/**
 * Register a new user with email and password
 */
export const registerUser = asyncHandler(async (req, res) => {
    // Get user details from request
    const { name, email, password, phone, countryCode } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
        throw new ApiError(400, "Name, email, and password are required");
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(409, "User with this email already exists");
    }
    
    // Create a new user
    const user = await User.create({
        name,
        email,
        password,
        phone,
        countryCode: countryCode || "+91"
    });
    
    // Generate and save OTP
    const otp = generateOTP();
    await OTP.create({ email, otp });
    
    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, name);
    
    if (!emailSent) {
        throw new ApiError(500, "Failed to send verification email");
    }
    
    // Return response without sensitive information
    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    
    return res.status(201).json(
        new ApiResponse(
            201,
            { user: createdUser },
            "User registered successfully. Please verify your email."
        )
    );
});

/**
 * Verify email with OTP
 */
export const verifyEmail = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        throw new ApiError(400, "Email and OTP are required");
    }
    
    // Find the OTP document
    const otpRecord = await OTP.findOne({ email });
    
    if (!otpRecord) {
        throw new ApiError(400, "OTP expired or not found");
    }
    
    // Verify OTP
    if (!otpRecord.verifyOTP(otp)) {
        throw new ApiError(400, "Invalid OTP");
    }
    
    // Update user as verified
    const user = await User.findOneAndUpdate(
        { email },
        { emailVerified: true },
        { new: true }
    ).select("-password -refreshToken");
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Delete the OTP document
    await OTP.findByIdAndDelete(otpRecord._id);
    
    // Send welcome email
    sendWelcomeEmail(email, user.name).catch(error => {
        console.error("Error sending welcome email:", error);
    });
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user);
    
    // Set cookies
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    };
    
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                { user, accessToken, refreshToken },
                "Email verified successfully"
            )
        );
});

/**
 * Resend verification OTP
 */
export const resendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        throw new ApiError(400, "Email is required");
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // If user is already verified, return error
    if (user.emailVerified) {
        throw new ApiError(400, "Email is already verified");
    }
    
    // Delete any existing OTP
    await OTP.deleteMany({ email });
    
    // Generate and save new OTP
    const otp = generateOTP();
    await OTP.create({ email, otp });
    
    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, user.name);
    
    if (!emailSent) {
        throw new ApiError(500, "Failed to send verification email");
    }
    
    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Verification OTP sent successfully"
        )
    );
});

/**
 * Login with email and password
 */
export const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Check if the user was registered with Google
    if (user.googleId && !user.password) {
        throw new ApiError(400, "This account was registered with Google. Please use Google sign-in.");
    }
    
    // Check password
    const isPasswordValid = await user.isPasswordCorrect(password);
    
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
    }
    
    // Check if email is verified
    if (!user.emailVerified) {
        // Generate and send new OTP
        const otp = generateOTP();
        await OTP.create({ email, otp });
        
        await sendOTPEmail(email, otp, user.name);
        
        throw new ApiError(403, "Email not verified. A new verification code has been sent to your email.");
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user);
    
    // Get user without sensitive information
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    
    // Set cookies
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    };
    
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "Login successful"
            )
        );
});

/**
 * Login or register with Google
 */
export const googleAuth = asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    
    if (!idToken) {
        throw new ApiError(400, "Google ID token is required");
    }
    
    // Verify the Google ID token
    const googleUser = await verifyGoogleIdToken(idToken);
    
    if (!googleUser) {
        throw new ApiError(400, "Invalid Google ID token");
    }
    
    // Check if user exists
    let user = await User.findOne({ email: googleUser.email });
    
    if (user) {
        // Update Google ID if not already set
        if (!user.googleId) {
            user.googleId = googleUser.sub;
            user.emailVerified = true; // Google accounts come with verified emails
            
            if (googleUser.picture && !user.avatar) {
                user.avatar = googleUser.picture;
            }
            
            await user.save({ validateBeforeSave: false });
        }
    } else {
        // Create new user
        user = await User.create({
            name: googleUser.name,
            email: googleUser.email,
            googleId: googleUser.sub,
            avatar: googleUser.picture,
            emailVerified: true
        });
        
        // Send welcome email
        sendWelcomeEmail(googleUser.email, googleUser.name).catch(error => {
            console.error("Error sending welcome email:", error);
        });
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user);
    
    // Get user without sensitive information
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    
    // Set cookies
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    };
    
    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "Google authentication successful"
            )
        );
});

/**
 * Logout user
 */
export const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }
        },
        { new: true }
    );
    
    // Clear cookies
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    };
    
    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(
            new ApiResponse(
                200,
                {},
                "Logout successful"
            )
        );
}); 