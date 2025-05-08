import { OAuth2Client } from 'google-auth-library';

/**
 * Verify a Google ID token and return user information
 * @param {string} idToken - Google ID token to verify
 * @returns {Promise<Object|null>} User info or null if verification fails
 */
export const verifyGoogleIdToken = async (idToken) => {
    try {
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        
        return payload;
    } catch (error) {
        console.error('Error verifying Google ID token:', error);
        return null;
    }
}; 