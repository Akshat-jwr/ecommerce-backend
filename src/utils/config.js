/**
 * Validates that required environment variables are set
 * @returns {void}
 * @throws {Error} If required variables are not set
 */
export const validateAuthEnvVariables = () => {
    const requiredVariables = [
        "PORT",
        "CORS_ORIGIN",
        "MONGODB_URI",
        "ACCESS_TOKEN_SECRET",
        "REFRESH_TOKEN_SECRET",
        "ACCESS_TOKEN_EXPIRY", 
        "REFRESH_TOKEN_EXPIRY",
        "EMAIL_SERVICE",
        "EMAIL_USER",
        "EMAIL_PASS",
        "GOOGLE_CLIENT_ID"
    ];
    
    const missingVariables = requiredVariables.filter(variable => {
        return !process.env[variable];
    });
    
    if (missingVariables.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVariables.join(", ")}`);
    }
    
    console.log("✅ All required environment variables are set");
}; 