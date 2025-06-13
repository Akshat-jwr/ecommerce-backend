import { User } from "../../models/user.model.js";
import { Order } from "../../models/order.model.js";
import { UserBehavior } from "../../models/userBehavior.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";

/**
 * Get user profile with enhanced data
 */
export const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-password -refreshToken")
    .lean();

  // Get user statistics
  const [orderStats, behaviorStats] = await Promise.all([
    Order.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
          avgOrderValue: { $avg: "$total" }
        }
      }
    ]),
    UserBehavior.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          totalProductViews: {
            $sum: { $cond: [{ $eq: ["$interactionType", "product_view"] }, 1, 0] }
          },
          totalTimeSpent: { $sum: "$timeSpent" },
          avgEngagement: { $avg: "$engagementScore" }
        }
      }
    ])
  ]);

  const profile = {
    ...user,
    stats: {
      orders: orderStats[0] || { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 },
      behavior: behaviorStats[0] || { totalProductViews: 0, totalTimeSpent: 0, avgEngagement: 0 }
    }
  };

  return res.status(200).json(
    new ApiResponse(200, profile, "Profile retrieved successfully")
  );
});

/**
 * Update user profile
 */
export const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, phone, dateOfBirth, preferences } = req.body;
  
  const updateData = {};
  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;
  if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
  if (preferences) updateData.preferences = preferences;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  return res.status(200).json(
    new ApiResponse(200, user, "Profile updated successfully")
  );
});

/**
 * Change user password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);
  
  const isPasswordValid = await user.isPasswordCorrect(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(400, "Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Password changed successfully")
  );
});

/**
 * Upload user avatar
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Avatar file is required");
  }

  try {
    const avatarResponse = await uploadOnCloudinary(req.file.path, "avatars");
    
    if (!avatarResponse) {
      throw new ApiError(500, "Error uploading avatar");
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarResponse.secure_url },
      { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(
      new ApiResponse(200, { avatar: user.avatar }, "Avatar updated successfully")
    );
  } catch (error) {
    throw new ApiError(500, "Error uploading avatar");
  }
});

/**
 * Get user dashboard data
 */
export const getUserDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [recentOrders, recentViews, preferences] = await Promise.all([
    // Recent orders
    Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("items.product", "name images price")
      .select("_id status total createdAt items"),

    // Recent product views (if UserBehavior model exists)
    UserBehavior.find({
      userId,
      interactionType: "product_view"
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate("productId", "name images price category")
      .select("productId timestamp timeSpent")
      .catch(() => []), // Fallback if model doesn't exist

    // User preferences based on behavior
    UserBehavior.getUserPreferences ? 
      UserBehavior.getUserPreferences(userId).catch(() => []) : 
      Promise.resolve([])
  ]);

  const dashboardData = {
    recentOrders,
    recentViews,
    preferences: preferences.slice(0, 5),
    stats: {
      totalOrders: recentOrders.length,
      totalViews: recentViews.length,
      preferredCategories: preferences.length
    }
  };

  return res.status(200).json(
    new ApiResponse(200, dashboardData, "Dashboard data retrieved successfully")
  );
});
/**
 * Delete user account
 */
export const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Check if user has pending orders
  const pendingOrders = await Order.exists({
    user: userId,
    status: { $in: ["pending", "processing", "shipped"] }
  });

  if (pendingOrders) {
    throw new ApiError(400, "Cannot delete account with pending orders");
  }

  // Soft delete - deactivate account
  await User.findByIdAndUpdate(userId, {
    isActive: false,
    email: `deleted_${Date.now()}_${req.user.email}`,
    refreshToken: null
  });

  return res.status(200).json(
    new ApiResponse(200, {}, "Account deleted successfully")
  );
});
