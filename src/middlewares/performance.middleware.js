import { performance } from 'perf_hooks';
import logger from '../utils/logger.js';
import { CacheManager } from '../utils/cacheManager.js';

/**
 * Performance monitoring middleware
 */
export const performanceMonitor = (options = {}) => {
  const {
    logSlowRequests = true,
    slowRequestThreshold = 1000, // ms
    trackMemory = true,
    sampleRate = 1.0 // 100% by default
  } = options;

  return async (req, res, next) => {
    // Sample requests based on rate
    if (Math.random() > sampleRate) {
      return next();
    }

    const startTime = performance.now();
    const startMemory = trackMemory ? process.memoryUsage() : null;

    // Track response metrics
    const originalSend = res.send;
    const originalJson = res.json;

    let responseSize = 0;

    res.send = function(data) {
      if (data) {
        responseSize = Buffer.byteLength(data, 'utf8');
      }
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      if (data) {
        responseSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
      }
      return originalJson.call(this, data);
    };

    // Listen for response finish
    res.on('finish', async () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const endMemory = trackMemory ? process.memoryUsage() : null;

      const metrics = {
        method: req.method,
        path: req.route?.path || req.path,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        responseSize,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        userId: req.user?._id,
        timestamp: new Date().toISOString()
      };

      // Add memory metrics if enabled
      if (trackMemory && startMemory && endMemory) {
        metrics.memoryUsage = {
          heapUsedDelta: endMemory.heapUsed - startMemory.heapUsed,
          heapTotalDelta: endMemory.heapTotal - startMemory.heapTotal,
          externalDelta: endMemory.external - startMemory.external,
          rss: endMemory.rss
        };
      }

      // Log slow requests
      if (logSlowRequests && duration > slowRequestThreshold) {
        logger.warn('Slow request detected', metrics);
      }

      // Store metrics for analysis
      await storeMetrics(metrics);

      // Update real-time performance counters
      await updatePerformanceCounters(metrics);
    });

    next();
  };
};

/**
 * Store performance metrics
 */
async function storeMetrics(metrics) {
  try {
    // Store in cache for real-time dashboard
    const key = `metrics:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    await CacheManager.set(key, metrics, 3600); // 1 hour TTL

    // Store in time-series for aggregation
    const hourKey = `metrics:hourly:${new Date().toISOString().substr(0, 13)}`;
    await CacheManager.addToSet(hourKey, JSON.stringify(metrics), 3600 * 24); // 24 hours

    // Log to structured logger for long-term storage
    logger.info('Request metrics', metrics);
  } catch (error) {
    logger.error('Error storing performance metrics:', error);
  }
}

/**
 * Update performance counters
 */
async function updatePerformanceCounters(metrics) {
  try {
    const minute = new Date().toISOString().substr(0, 16); // YYYY-MM-DDTHH:MM
    
    // Request count
    await CacheManager.increment(`perf:requests:${minute}`, 1, 300);
    
    // Average response time
    await CacheManager.increment(`perf:duration:${minute}`, metrics.duration, 300);
    
    // Error count
    if (metrics.statusCode >= 400) {
      await CacheManager.increment(`perf:errors:${minute}`, 1, 300);
    }
    
    // Response size
    await CacheManager.increment(`perf:bytes:${minute}`, metrics.responseSize || 0, 300);
    
    // Endpoint-specific metrics
    const endpointKey = `${metrics.method}:${metrics.path}`.replace(/[^a-zA-Z0-9:]/g, '_');
    await CacheManager.increment(`perf:endpoint:${endpointKey}:${minute}`, 1, 300);
  } catch (error) {
    logger.error('Error updating performance counters:', error);
  }
}

/**
 * Database query performance tracker
 */
export const queryPerformanceTracker = () => {
  return (schema) => {
    schema.pre(/^find/, function() {
      this._startTime = performance.now();
    });

    schema.post(/^find/, async function(docs) {
      if (this._startTime) {
        const duration = performance.now() - this._startTime;
        
        const queryMetrics = {
          model: this.model.modelName,
          operation: this.op,
          duration: Math.round(duration * 100) / 100,
          resultCount: Array.isArray(docs) ? docs.length : (docs ? 1 : 0),
          query: JSON.stringify(this.getQuery()),
          options: JSON.stringify(this.getOptions()),
          timestamp: new Date().toISOString()
        };

        // Log slow queries
        if (duration > 100) { // 100ms threshold
          logger.warn('Slow database query', queryMetrics);
        }

        // Store query metrics
        try {
          const key = `db:metrics:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
          await CacheManager.set(key, queryMetrics, 3600);
          
          // Update query counters
          const minute = new Date().toISOString().substr(0, 16);
          await CacheManager.increment(`db:queries:${minute}`, 1, 300);
          await CacheManager.increment(`db:duration:${minute}`, duration, 300);
        } catch (error) {
          // Don't let metrics tracking break the app
          console.error('Error storing query metrics:', error);
        }
      }
    });
  };
};

/**
 * Memory monitoring
 */
export const memoryMonitor = (intervalMs = 30000) => {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memMetrics = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      timestamp: new Date().toISOString()
    };

    // Log memory warnings
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    if (usagePercent > 90) {
      logger.warn('High memory usage detected', { usagePercent, ...memMetrics });
    }

    // Store memory metrics
    CacheManager.set(`memory:${Date.now()}`, memMetrics, 3600).catch(err => {
      console.error('Error storing memory metrics:', err);
    });
  }, intervalMs);
};

/**
 * Get performance statistics
 */
export const getPerformanceStats = async (timeframe = 'hour') => {
  try {
    const now = new Date();
    let startTime, keyPattern;

    switch (timeframe) {
      case 'minute':
        startTime = new Date(now.getTime() - 60 * 1000);
        keyPattern = 'perf:*:' + now.toISOString().substr(0, 16);
        break;
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        keyPattern = 'perf:*:' + now.toISOString().substr(0, 13) + '*';
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        keyPattern = 'perf:*:' + now.toISOString().substr(0, 10) + '*';
        break;
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        keyPattern = 'perf:*:' + now.toISOString().substr(0, 13) + '*';
    }

    // Get aggregated metrics from cache
    const keys = await CacheManager.redis.keys(keyPattern);
    const values = keys.length > 0 ? await CacheManager.redis.mget(keys) : [];

    const stats = {
      totalRequests: 0,
      totalDuration: 0,
      totalErrors: 0,
      totalBytes: 0,
      averageResponseTime: 0,
      errorRate: 0,
      requestsPerSecond: 0,
      timeframe,
      startTime: startTime.toISOString(),
      endTime: now.toISOString()
    };

    // Aggregate the metrics
    values.forEach(value => {
      if (value) {
        const num = parseInt(value) || 0;
        if (value.includes('requests:')) stats.totalRequests += num;
        if (value.includes('duration:')) stats.totalDuration += num;
        if (value.includes('errors:')) stats.totalErrors += num;
        if (value.includes('bytes:')) stats.totalBytes += num;
      }
    });

    // Calculate derived metrics
    if (stats.totalRequests > 0) {
      stats.averageResponseTime = stats.totalDuration / stats.totalRequests;
      stats.errorRate = (stats.totalErrors / stats.totalRequests) * 100;
    }

    const timeframeDuration = (now.getTime() - startTime.getTime()) / 1000;
    stats.requestsPerSecond = stats.totalRequests / timeframeDuration;

    return stats;
  } catch (error) {
    logger.error('Error getting performance stats:', error);
    throw error;
  }
};

export default {
  performanceMonitor,
  queryPerformanceTracker,
  memoryMonitor,
  getPerformanceStats
};
