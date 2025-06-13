import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const createOrder = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Order creation functionality to be implemented")
  );
});

export const getUserOrders = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, [], "User orders functionality to be implemented")
  );
});

export const getOrderById = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Get order by ID functionality to be implemented")
  );
});

export const cancelOrder = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Cancel order functionality to be implemented")
  );
});

export const getOrderTracking = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Order tracking functionality to be implemented")
  );
});
