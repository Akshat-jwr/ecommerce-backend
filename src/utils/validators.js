/**
 * Check if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to check
 * @returns {boolean} - Whether the ID is valid
 */
export const isValidObjectId = (id) => {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(id);
};

/**
 * Check if a string is a valid email
 * @param {string} email - The email to check
 * @returns {boolean} - Whether the email is valid
 */
export const isValidEmail = (email) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
};

/**
 * Check if a string is a valid phone number (10 digits)
 * @param {string} phone - The phone number to check
 * @returns {boolean} - Whether the phone number is valid
 */
export const isValidPhone = (phone) => {
    const phonePattern = /^[0-9]{10}$/;
    return phonePattern.test(phone);
};

/**
 * Check if a password meets minimum requirements
 * @param {string} password - The password to check
 * @returns {boolean} - Whether the password is valid
 */
export const isValidPassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordPattern.test(password);
};

/**
 * Sanitize an object by removing specified fields
 * @param {Object} obj - The object to sanitize
 * @param {Array<string>} fieldsToRemove - Fields to remove
 * @returns {Object} - The sanitized object
 */
export const sanitizeObject = (obj, fieldsToRemove = ['password', 'refreshToken']) => {
    const sanitized = { ...obj };
    fieldsToRemove.forEach(field => {
        delete sanitized[field];
    });
    return sanitized;
}; 