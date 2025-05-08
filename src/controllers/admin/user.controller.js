import { User } from "../../models/user.model.js";
import { Order } from "../../models/order.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Get all users with filtering, sorting, and pagination
 * @route GET /api/v1/admin/users
 * @access Admin
 */
export const getAllUsers = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        sort = "createdAt",
        order = "desc",
        search = "",
        role,
        isActive
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter object
    const filter = {};

    // Add search filter if provided
    if (search) {
        filter.$or = [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } }
        ];
    }

    // Add role filter if provided
    if (role) {
        filter.role = role;
    }

    // Add active status filter if provided
    if (isActive !== undefined) {
        filter.isActive = isActive === "true";
    }

    // Count total users matching the filter
    const totalUsers = await User.countDocuments(filter);

    // Get users with pagination, sorting and filtering
    const users = await User.find(filter)
        .select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry")
        .sort({ [sort]: order === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limitNumber);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                users,
                pagination: {
                    total: totalUsers,
                    page: pageNumber,
                    limit: limitNumber,
                    pages: Math.ceil(totalUsers / limitNumber)
                }
            },
            "Users retrieved successfully"
        )
    );
});

/**
 * Get a user by ID
 * @route GET /api/v1/admin/users/:id
 * @access Admin
 */
export const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const user = await User.findById(id)
        .select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Get order stats
    const orderStats = await Order.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(id) } },
        { $group: {
            _id: null,
            orderCount: { $sum: 1 },
            totalSpent: { $sum: "$total" },
            averageOrderValue: { $avg: "$total" }
        }}
    ]);

    // Get recent orders
    const recentOrders = await Order.find({ user: id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("_id status total createdAt items");

    const userDetails = {
        user,
        stats: orderStats.length > 0 ? {
            orderCount: orderStats[0].orderCount,
            totalSpent: orderStats[0].totalSpent,
            averageOrderValue: orderStats[0].averageOrderValue
        } : {
            orderCount: 0,
            totalSpent: 0,
            averageOrderValue: 0
        },
        recentOrders
    };

    return res.status(200).json(
        new ApiResponse(200, userDetails, "User details retrieved successfully")
    );
});

/**
 * Update user role
 * @route PATCH /api/v1/admin/users/:id/role
 * @access Admin
 */
export const updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid user ID");
    }

    if (!role) {
        throw new ApiError(400, "Role is required");
    }

    // Validate role
    const validRoles = ["user", "admin"];
    if (!validRoles.includes(role)) {
        throw new ApiError(400, "Invalid role value");
    }

    // Cannot change own role - to prevent admin from accidentally removing their own access
    if (id === req.user._id.toString()) {
        throw new ApiError(400, "You cannot change your own role");
    }

    const user = await User.findById(id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    user.role = role;
    await user.save();

    return res.status(200).json(
        new ApiResponse(
            200, 
            { user: { _id: user._id, email: user.email, role: user.role } }, 
            "User role updated successfully"
        )
    );
});

/**
 * Toggle user active status (block/unblock)
 * @route PATCH /api/v1/admin/users/:id/toggle-active
 * @access Admin
 */
export const toggleUserActiveStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid user ID");
    }

    // Cannot deactivate own account
    if (id === req.user._id.toString()) {
        throw new ApiError(400, "You cannot block your own account");
    }

    const user = await User.findById(id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Toggle isActive status
    user.isActive = !user.isActive;
    await user.save();

    const actionText = user.isActive ? "unblocked" : "blocked";

    return res.status(200).json(
        new ApiResponse(
            200, 
            { user: { _id: user._id, email: user.email, isActive: user.isActive } }, 
            `User ${actionText} successfully`
        )
    );
});

/**
 * Delete a user
 * @route DELETE /api/v1/admin/users/:id
 * @access Admin
 */
export const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid user ID");
    }

    // Cannot delete own account
    if (id === req.user._id.toString()) {
        throw new ApiError(400, "You cannot delete your own account");
    }

    const user = await User.findById(id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Check if user has any orders
    const hasOrders = await Order.exists({ user: id });
    if (hasOrders) {
        // If user has orders, don't delete but deactivate account
        user.isActive = false;
        user.email = `deleted-${user.email}`;
        await user.save();

        return res.status(200).json(
            new ApiResponse(
                200, 
                {}, 
                "User has existing orders and has been deactivated instead of deleted"
            )
        );
    }

    // If no orders, completely delete the user
    await User.findByIdAndDelete(id);

    return res.status(200).json(
        new ApiResponse(200, {}, "User deleted successfully")
    );
}); 