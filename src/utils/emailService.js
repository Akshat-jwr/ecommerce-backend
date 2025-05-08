import nodemailer from 'nodemailer';

/**
 * Create a nodemailer transporter
 */
const createTransporter = () => {
    return nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

/**
 * Generate a random OTP
 * @param {number} length - Length of OTP
 * @returns {string} - Generated OTP
 */
export const generateOTP = (length = 6) => {
    const digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < length; i++) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
};

/**
 * Send OTP email for verification
 * @param {string} email - Recipient email
 * @param {string} otp - OTP to send
 * @param {string} name - Recipient name
 * @returns {Promise<boolean>} - Success status
 */
export const sendOTPEmail = async (email, otp, name) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: `"Gifts E-commerce" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your Email',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #333;">Hello ${name || 'there'}!</h2>
                    <p>Thank you for signing up. To complete your registration, please enter the following OTP:</p>
                    <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This OTP is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
                    <p>Best regards,<br>Gifts E-commerce Team</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        return false;
    }
};

/**
 * Send welcome email after successful registration
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @returns {Promise<boolean>} - Success status
 */
export const sendWelcomeEmail = async (email, name) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: `"Gifts E-commerce" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Welcome to Gifts E-commerce!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #333;">Welcome, ${name || 'there'}!</h2>
                    <p>Thank you for joining Gifts E-commerce. We're excited to have you as part of our community!</p>
                    <p>You can now browse our catalog of customized gifts and place orders.</p>
                    <p>If you have any questions or need assistance, feel free to contact our support team.</p>
                    <p>Best regards,<br>Gifts E-commerce Team</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return false;
    }
}; 