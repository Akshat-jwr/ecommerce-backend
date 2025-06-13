import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const createReview = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Review creation functionality to be implemented")
  );
});

export const getUserReviews = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, [], "User reviews functionality to be implemented")
  );
});

export const updateReview = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Update review functionality to be implemented")
  );
});

export const deleteReview = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Delete review functionality to be implemented")
  );
});
