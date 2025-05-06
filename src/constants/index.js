/**
 * Order status constants
 */
export const ORDER_STATUS = {
    PLACED: "Placed",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled"
};

/**
 * Payment status constants
 */
export const PAYMENT_STATUS = {
    PENDING: "Pending",
    PAID: "Paid",
    FAILED: "Failed",
    REFUNDED: "Refunded"
};

/**
 * Product status constants
 */
export const PRODUCT_STATUS = {
    AVAILABLE: "Available",
    OUT_OF_STOCK: "OutOfStock",
    DISCONTINUED: "Discontinued",
    COMING_SOON: "ComingSoon"
};

/**
 * User role constants
 */
export const USER_ROLES = {
    USER: "user",
    ADMIN: "admin"
};

/**
 * Admin activity types
 */
export const ADMIN_ACTIVITIES = {
    CREATE: "create",
    UPDATE: "update",
    DELETE: "delete",
    VIEW: "view",
    EXPORT: "export",
    LOGIN: "login",
    LOGOUT: "logout",
    OTHER: "other"
};

/**
 * Admin activity targets
 */
export const ADMIN_TARGETS = {
    PRODUCT: "product",
    ORDER: "order",
    USER: "user",
    COUPON: "coupon",
    REVIEW: "review",
    SETTING: "setting",
    OTHER: "other"
};

/**
 * Payment methods
 */
export const PAYMENT_METHODS = {
    COD: "COD",
    CREDIT_CARD: "Credit Card",
    DEBIT_CARD: "Debit Card",
    UPI: "UPI",
    PAYPAL: "PayPal"
}; 