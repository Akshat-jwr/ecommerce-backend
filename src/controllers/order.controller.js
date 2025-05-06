import { Order } from '../models/order.model.js';
import { createOrderAttachmentsZip, getOrderAttachmentsZipUrl } from '../utils/fileUpload.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Upload attachments for an order and create zip file
 */
export const uploadOrderAttachments = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
        throw new ApiError(400, "No files uploaded");
    }
    
    try {
        // Check if order exists
        const order = await Order.findById(orderId);
        if (!order) {
            throw new ApiError(404, "Order not found");
        }
        
        // Create zip file from uploaded files
        await createOrderAttachmentsZip(orderId);
        
        // Get the URL path for the zip file
        const zipUrl = getOrderAttachmentsZipUrl(orderId);
        
        // Update order with attachment info
        order.attachments = {
            zipFilePath: zipUrl,
            uploadedAt: new Date()
        };
        
        await order.save();
        
        // Return success response
        return res.status(200).json(
            new ApiResponse(
                200,
                { zipUrl },
                "Files uploaded and zip created successfully"
            )
        );
    } catch (error) {
        throw new ApiError(500, "Error processing attachments: " + error.message);
    }
}); 