import { Order } from "../../models/order.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Get all orders with filtering, sorting, and pagination
 * @route GET /api/v1/admin/orders
 * @access Admin
 */
export const getAllOrders = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        sort = "createdAt",
        order = "desc",
        status,
        startDate,
        endDate,
        minAmount,
        maxAmount
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter object
    const filter = {};

    // Filter by status
    if (status) {
        filter.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
        filter.createdAt = {};
        
        if (startDate) {
            filter.createdAt.$gte = new Date(startDate);
        }
        
        if (endDate) {
            // Set to end of the day for endDate
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = endOfDay;
        }
    }

    // Filter by total amount range
    if (minAmount !== undefined || maxAmount !== undefined) {
        filter.total = {};
        
        if (minAmount !== undefined) {
            filter.total.$gte = parseFloat(minAmount);
        }
        
        if (maxAmount !== undefined) {
            filter.total.$lte = parseFloat(maxAmount);
        }
    }

    // Count total orders matching the filter
    const totalOrders = await Order.countDocuments(filter);

    // Get orders with pagination, sorting and filtering
    const orders = await Order.find(filter)
        .sort({ [sort]: order === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limitNumber)
        .populate("user", "firstName lastName email")
        .populate("items.product", "name images");

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                orders,
                pagination: {
                    total: totalOrders,
                    page: pageNumber,
                    limit: limitNumber,
                    pages: Math.ceil(totalOrders / limitNumber)
                }
            },
            "Orders retrieved successfully"
        )
    );
});

/**
 * Get an order by ID
 * @route GET /api/v1/admin/orders/:id
 * @access Admin
 */
export const getOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid order ID");
    }

    const order = await Order.findById(id)
        .populate("user", "firstName lastName email")
        .populate("items.product", "name description price images");

    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    return res.status(200).json(
        new ApiResponse(200, order, "Order retrieved successfully")
    );
});

/**
 * Update order status
 * @route PATCH /api/v1/admin/orders/:id/status
 * @access Admin
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes, trackingNumber } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid order ID");
    }

    if (!status) {
        throw new ApiError(400, "Status is required");
    }

    // Validate status value
    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];
    if (!validStatuses.includes(status)) {
        throw new ApiError(400, "Invalid status value");
    }

    const order = await Order.findById(id);
    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    // Update order
    const updateData = { status };
    if (notes !== undefined) updateData.notes = notes;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;

    const updatedOrder = await Order.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
    ).populate("user", "firstName lastName email");

    // TODO: Send email notification to customer about status change

    return res.status(200).json(
        new ApiResponse(200, updatedOrder, "Order status updated successfully")
    );
});

/**
 * Delete an order
 * @route DELETE /api/v1/admin/orders/:id
 * @access Admin
 */
export const deleteOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid order ID");
    }

    const order = await Order.findById(id);
    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    // Only allow deleting orders in certain statuses
    const deletableStatuses = ["cancelled", "refunded", "pending"];
    if (!deletableStatuses.includes(order.status)) {
        throw new ApiError(400, `Cannot delete order in ${order.status} status. Order must be cancelled or refunded first.`);
    }

    await Order.findByIdAndDelete(id);

    return res.status(200).json(
        new ApiResponse(200, {}, "Order deleted successfully")
    );
}); 