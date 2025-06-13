import { body } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

export const validateOrderCreation = [
  body("shippingAddressId")
    .isMongoId()
    .withMessage("Invalid shipping address ID"),
  
  body("paymentMethod")
    .isIn(["upi", "credit_card", "cash_on_delivery"])
    .withMessage("Invalid payment method"),
  
  body("paymentData")
    .optional()
    .custom((value, { req }) => {
      const { paymentMethod } = req.body;
      
      if (paymentMethod === "upi") {
        if (!value.upiId) {
          throw new Error("UPI ID is required for UPI payments");
        }
        if (!value.upiId.includes("@")) {
          throw new Error("Invalid UPI ID format");
        }
      }
      
      if (paymentMethod === "credit_card") {
        if (!value.cardNumber || !value.expiryMonth || !value.expiryYear || !value.cvv) {
          throw new Error("Card details are required for card payments");
        }
        if (value.cardNumber.length < 16) {
          throw new Error("Invalid card number");
        }
      }
      
      return true;
    }),
  
  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters")
];
