import { Product } from "../../models/product.model.js";
import { Order } from "../../models/order.model.js";
import { User } from "../../models/user.model.js";
import { Category } from "../../models/category.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * Get dashboard statistics
 * @route GET /api/v1/admin/dashboard/stats
 * @access Admin
 * @returns {Object} Dashboard statistics including counts and revenue data
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
    // Get counts
    const productCount = await Product.countDocuments();
    const orderCount = await Order.countDocuments();
    const userCount = await User.countDocuments({ role: "user" });
    const categoryCount = await Category.countDocuments();

    // Get revenue stats
    const revenueData = await Order.aggregate([
        {
            $match: {
                status: { $in: ["delivered", "shipped", "processing"] }
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: "$totalAmount" },
                averageOrderValue: { $avg: "$totalAmount" }
            }
        }
    ]);

    const revenue = revenueData.length > 0 ? {
        totalRevenue: revenueData[0].totalRevenue || 0,
        averageOrderValue: revenueData[0].averageOrderValue || 0
    } : {
        totalRevenue: 0,
        averageOrderValue: 0
    };

    // Get recent activity
    const recentOrders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("user", "name email")
        .select("user totalAmount status createdAt");

    const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
        .sort({ stock: 1 })
        .limit(5)
        .select("name stock price");

    // Combine all stats
    const stats = {
        counts: {
            products: productCount,
            orders: orderCount,
            users: userCount,
            categories: categoryCount
        },
        revenue,
        recentActivity: {
            recentOrders,
            lowStockProducts
        }
    };

    return res.status(200).json(
        new ApiResponse(200, stats, "Dashboard statistics retrieved successfully")
    );
});

/**
 * Get order statistics by status
 * @route GET /api/v1/admin/dashboard/orders-stats
 * @access Admin
 * @returns {Object} Order statistics grouped by status
 */
export const getOrderStats = asyncHandler(async (req, res) => {
    const orderStats = await Order.aggregate([
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                revenue: { $sum: "$totalAmount" }
            }
        },
        {
            $project: {
                status: "$_id",
                count: 1,
                revenue: 1,
                _id: 0
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, orderStats, "Order statistics retrieved successfully")
    );
});

/**
 * Get revenue data for chart (last 7 days)
 * @route GET /api/v1/admin/dashboard/revenue-chart
 * @access Admin
 * @returns {Object} Daily revenue data for the last 7 days
 */
export const getRevenueChartData = asyncHandler(async (req, res) => {
    // Calculate date for 7 days ago
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);

    // Aggregate daily revenue
    const revenueData = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: lastWeekDate },
                status: { $nin: ["cancelled", "refunded"] }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                },
                revenue: { $sum: "$totalAmount" },
                orders: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }
        },
        {
            $project: {
                date: "$_id",
                revenue: 1,
                orders: 1,
                _id: 0
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, revenueData, "Revenue chart data retrieved successfully")
    );
}); 