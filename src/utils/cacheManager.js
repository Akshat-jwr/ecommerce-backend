import Redis from 'ioredis';
import { promisify } from 'util';
import logger from './logger.js';

class CacheManager {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    // Default TTL in seconds
    this.defaultTTL = 3600; // 1 hour
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async invalidatePattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`Invalidated ${keys.length} cache keys with pattern: ${pattern}`);
      }
      return true;
    } catch (error) {
      logger.error('Cache pattern invalidation error:', error);
      return false;
    }
  }

  /**
   * Get or set cache with callback
   */
  async getOrSet(key, callback, ttl = this.defaultTTL) {
    try {
      let value = await this.get(key);
      
      if (value === null) {
        value = await callback();
        if (value !== null && value !== undefined) {
          await this.set(key, value, ttl);
        }
      }
      
      return value;
    } catch (error) {
      logger.error('Cache getOrSet error:', error);
      // Fallback to callback if cache fails
      return await callback();
    }
  }

  /**
   * Increment counter in cache
   */
  async increment(key, amount = 1, ttl = this.defaultTTL) {
    try {
      const value = await this.redis.incrby(key, amount);
      if (ttl > 0) {
        await this.redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error('Cache increment error:', error);
      return null;
    }
  }

  /**
   * Add to set
   */
  async addToSet(key, value, ttl = this.defaultTTL) {
    try {
      await this.redis.sadd(key, value);
      if (ttl > 0) {
        await this.redis.expire(key, ttl);
      }
      return true;
    } catch (error) {
      logger.error('Cache addToSet error:', error);
      return false;
    }
  }

  /**
   * Get set members
   */
  async getSetMembers(key) {
    try {
      return await this.redis.smembers(key);
    } catch (error) {
      logger.error('Cache getSetMembers error:', error);
      return [];
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      return await this.redis.exists(key) === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key, ttl) {
    try {
      await this.redis.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        connected: this.redis.status === 'ready'
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return { connected: false };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const result = {};
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = isNaN(value) ? value : Number(value);
        }
      }
    });
    
    return result;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        connected: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }
  }

  /**
   * Cache warming utilities
   */
  async warmCache() {
    logger.info('Starting cache warming process...');
    
    try {
      // Warm popular products
      await this.warmPopularProducts();
      
      // Warm categories
      await this.warmCategories();
      
      // Warm featured products
      await this.warmFeaturedProducts();
      
      logger.info('Cache warming completed successfully');
    } catch (error) {
      logger.error('Cache warming failed:', error);
    }
  }

  async warmPopularProducts() {
    // Implementation would fetch and cache popular products
    logger.info('Warming popular products cache...');
  }

  async warmCategories() {
    // Implementation would fetch and cache categories
    logger.info('Warming categories cache...');
  }

  async warmFeaturedProducts() {
    // Implementation would fetch and cache featured products
    logger.info('Warming featured products cache...');
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    try {
      await this.redis.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

export { cacheManager as CacheManager };
export default cacheManager;
