const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        // Pass error to Express error handler
        next(error);
    }
};

export { asyncHandler };