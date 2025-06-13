import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import MongoStore from 'rate-limit-mongo';
import { CacheManager } from '../utils/cacheManager.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';
import { User } from '../models/user.model.js';

/**
 * Advanced rate limiting with different tiers
 */
export const createAdvancedRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxAttempts = 100,
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    store = 'memory' // 'memory', 'redis', 'mongo'
  } = options;

  const limiterConfig = {
    windowMs,
    max: maxAttempts,
    keyGenerator,
    skipSuccessfulRequests,
    skipFailedRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method
      });

      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  };

  // Configure store based on option
  if (store === 'mongo') {
    limiterConfig.store = new MongoStore({
      uri: process.env.MONGODB_URI,
      collectionName: 'rate_limits',
      expireTimeMs: windowMs
    });
  }

  return rateLimit(limiterConfig);
};

/**
 * Adaptive rate limiting based on user behavior
 */
export const adaptiveRateLimit = () => {
  return async (req, res, next) => {
    try {
      const ip = req.ip;
      const userId = req.user?._id;
      const key = userId ? `adaptive:user:${userId}` : `adaptive:ip:${ip}`;
      
      // Get user's recent behavior
      const recentBehavior = await CacheManager.get(key) || {
        requests: 0,
        errors: 0,
        lastRequest: Date.now(),
        riskScore: 0
      };

      const now = Date.now();
      const timeDiff = now - recentBehavior.lastRequest;

      // Reset counters if more than 1 hour has passed
      if (timeDiff > 3600000) {
        recentBehavior.requests = 0;
        recentBehavior.errors = 0;
        recentBehavior.riskScore = 0;
      }

      // Update counters
      recentBehavior.requests++;
      recentBehavior.lastRequest = now;

      // Calculate risk score
      const requestRate = recentBehavior.requests / (timeDiff / 60000 || 1); // requests per minute
      const errorRate = recentBehavior.errors / recentBehavior.requests;
      
      recentBehavior.riskScore = (requestRate * 0.6) + (errorRate * 0.4);

      // Apply adaptive limits
      let maxRequests = 100; // base limit
      
      if (recentBehavior.riskScore > 10) {
        maxRequests = 10; // High risk
      } else if (recentBehavior.riskScore > 5) {
        maxRequests = 30; // Medium risk
      } else if (userId && req.user?.role === 'admin') {
        maxRequests = 200; // Admin users get higher limits
      }

      // Check if limit exceeded
      if (requestRate > maxRequests) {
        logger.warn('Adaptive rate limit exceeded', {
          ip,
          userId,
          requestRate,
          errorRate,
          riskScore: recentBehavior.riskScore
        });

        return res.status(429).json({
          success: false,
          message: 'Request rate too high. Please slow down.',
          riskScore: recentBehavior.riskScore
        });
      }

      // Store updated behavior
      await CacheManager.set(key, recentBehavior, 3600);

      // Add risk score to request for downstream use
      req.riskScore = recentBehavior.riskScore;

      next();
    } catch (error) {
      logger.error('Error in adaptive rate limit:', error);
      next(); // Don't block request on error
    }
  };
};

/**
 * Request slowdown middleware
 */
export const requestSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs at full speed
  delayMs: 100, // Add 100ms delay after delayAfter is reached
  maxDelayMs: 5000, // Maximum delay of 5 seconds
  keyGenerator: (req) => req.ip
});

/**
 * Suspicious activity detection
 */
export const suspiciousActivityDetector = () => {
  return async (req, res, next) => {
    try {
      const indicators = [];
      const ip = req.ip;
      const userAgent = req.headers['user-agent'] || '';

      // Check for common attack patterns
      const suspiciousPatterns = [
        /(\.\.|\/etc\/passwd|\/proc\/|\.\.\/)/i, // Path traversal
        /(script|javascript|vbscript)/i, // Script injection
        /(union|select|insert|delete|drop|create|alter)/i, // SQL injection
        /(\<script|\<iframe|\<object)/i, // XSS
        /(eval|exec|system|passthru)/i // Code execution
      ];

      const urlToCheck = req.originalUrl + JSON.stringify(req.body || {});
      
      suspiciousPatterns.forEach((pattern, index) => {
        if (pattern.test(urlToCheck)) {
          indicators.push(`Pattern ${index + 1} matched`);
        }
      });

      // Check for bot-like behavior
      if (!userAgent || userAgent.length < 10) {
        indicators.push('Suspicious user agent');
      }

      // Check for rapid requests from same IP
      const rapidRequestKey = `rapid:${ip}`;
      const requestCount = await CacheManager.increment(rapidRequestKey, 1, 60);
      
      if (requestCount > 60) { // More than 60 requests per minute
        indicators.push('High request frequency');
      }

      // Check for requests from known bad IPs
      const badIpKey = `bad_ip:${ip}`;
      const isBadIp = await CacheManager.exists(badIpKey);
      
      if (isBadIp) {
        indicators.push('Known malicious IP');
      }

      // If suspicious activity detected
      if (indicators.length > 0) {
        logger.warn('Suspicious activity detected', {
          ip,
          userAgent,
          path: req.path,
          method: req.method,
          indicators,
          body: req.body
        });

        // Add to suspicious IPs if multiple indicators
        if (indicators.length >= 2) {
          await CacheManager.set(badIpKey, true, 3600); // Block for 1 hour
          
          return res.status(403).json({
            success: false,
            message: 'Suspicious activity detected. Access denied.'
          });
        }

        // Just log if only one indicator
        req.suspicious = true;
        req.suspiciousIndicators = indicators;
      }

      next();
    } catch (error) {
      logger.error('Error in suspicious activity detector:', error);
      next();
    }
  };
};

/**
 * CAPTCHA requirement middleware
 */
export const requireCaptcha = (threshold = 5) => {
  return async (req, res, next) => {
    try {
      const ip = req.ip;
      const failureKey = `captcha_failures:${ip}`;
      const failures = await CacheManager.get(failureKey) || 0;

      if (failures >= threshold) {
        const { captcha } = req.body;
        
        if (!captcha) {
          return res.status(400).json({
            success: false,
            message: 'CAPTCHA verification required',
            requiresCaptcha: true
          });
        }

        // Verify CAPTCHA (implement your CAPTCHA service here)
        const isValidCaptcha = await verifyCaptcha(captcha, ip);
        
        if (!isValidCaptcha) {
          await CacheManager.increment(failureKey, 1, 3600);
          return res.status(400).json({
            success: false,
            message: 'Invalid CAPTCHA. Please try again.',
            requiresCaptcha: true
          });
        }

        // Reset failures on successful CAPTCHA
        await CacheManager.delete(failureKey);
      }

      next();
    } catch (error) {
      logger.error('Error in CAPTCHA middleware:', error);
      next();
    }
  };
};

/**
 * Device fingerprinting
 */
export const deviceFingerprinting = () => {
  return async (req, res, next) => {
    try {
      const fingerprint = generateDeviceFingerprint(req);
      req.deviceFingerprint = fingerprint;

      // Store device info for user
      if (req.user) {
        const deviceKey = `device:${req.user._id}:${fingerprint}`;
        const deviceInfo = {
          fingerprint,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          lastSeen: new Date(),
          headers: {
            acceptLanguage: req.headers['accept-language'],
            acceptEncoding: req.headers['accept-encoding']
          }
        };

        await CacheManager.set(deviceKey, deviceInfo, 30 * 24 * 3600); // 30 days
      }

      next();
    } catch (error) {
      logger.error('Error in device fingerprinting:', error);
      next();
    }
  };
};

/**
 * Generate device fingerprint
 */
function generateDeviceFingerprint(req) {
  const data = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.ip
  ].join('|');

  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * CAPTCHA verification (mock implementation)
 */
async function verifyCaptcha(captcha, ip) {
  // Implement your CAPTCHA service verification here
  // This is a mock implementation
  return captcha === 'valid_captcha_response';
}

/**
 * Account lockout protection
 */
export const accountLockout = (maxAttempts = 5, lockoutDuration = 15 * 60 * 1000) => {
  return async (req, res, next) => {
    try {
      const identifier = req.body.email || req.ip;
      const key = `lockout:${identifier}`;
      
      const lockoutInfo = await CacheManager.get(key) || {
        attempts: 0,
        lockedUntil: null
      };

      // Check if account is currently locked
      if (lockoutInfo.lockedUntil && new Date() < new Date(lockoutInfo.lockedUntil)) {
        const remainingTime = Math.ceil((new Date(lockoutInfo.lockedUntil) - new Date()) / 1000);
        
        return res.status(423).json({
          success: false,
          message: `Account temporarily locked. Try again in ${remainingTime} seconds.`,
          lockedUntil: lockoutInfo.lockedUntil
        });
      }

      // Reset lockout if time has passed
      if (lockoutInfo.lockedUntil && new Date() >= new Date(lockoutInfo.lockedUntil)) {
        lockoutInfo.attempts = 0;
        lockoutInfo.lockedUntil = null;
      }

      req.lockoutInfo = lockoutInfo;
      req.lockoutKey = key;

      next();
    } catch (error) {
      logger.error('Error in account lockout middleware:', error);
      next();
    }
  };
};

/**
 * Handle failed login attempt
 */
export const handleFailedLogin = async (req) => {
  try {
    if (req.lockoutInfo && req.lockoutKey) {
      req.lockoutInfo.attempts++;
      
      if (req.lockoutInfo.attempts >= 5) {
        req.lockoutInfo.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        logger.warn('Account locked due to failed login attempts', {
          identifier: req.body.email || req.ip,
          attempts: req.lockoutInfo.attempts
        });
      }
      
      await CacheManager.set(req.lockoutKey, req.lockoutInfo, 24 * 3600); // 24 hours
    }
  } catch (error) {
    logger.error('Error handling failed login:', error);
  }
};

/**
 * Handle successful login
 */
export const handleSuccessfulLogin = async (req) => {
  try {
    if (req.lockoutKey) {
      await CacheManager.delete(req.lockoutKey);
    }
  } catch (error) {
    logger.error('Error handling successful login:', error);
  }
};

export default {
  createAdvancedRateLimit,
  adaptiveRateLimit,
  requestSlowDown,
  suspiciousActivityDetector,
  requireCaptcha,
  deviceFingerprinting,
  accountLockout,
  handleFailedLogin,
  handleSuccessfulLogin
};
