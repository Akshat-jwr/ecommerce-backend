import { User } from "../../models/user.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const getUserAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("addresses");
  
  return res.status(200).json(
    new ApiResponse(200, user.addresses, "Addresses retrieved successfully")
  );
});

export const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses.push(req.body);
  await user.save();

  return res.status(201).json(
    new ApiResponse(201, {}, "Address added successfully")
  );
});

export const updateAddress = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Address update functionality to be implemented")
  );
});

export const deleteAddress = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Address delete functionality to be implemented")
  );
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, {}, "Set default address functionality to be implemented")
  );
});
