/**
 * Per-client rate limiting middleware
 */

import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import type { Config } from '../config/schema.js';

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(config: Config) {
  if (!config.security.rateLimitEnabled) {
    // Return no-op middleware if rate limiting is disabled
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  return rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMaxRequests,
    
    // Use client ID from auth context for per-client limiting
    keyGenerator: (req) => {
      // Use authenticated client ID if available
      const authReq = req as Request;
      if (authReq.auth?.clientId) {
        return `client:${authReq.auth.clientId}`;
      }
      
      // Fall back to IP-based key for unauthenticated requests
      const forwardedFor = req.headers['x-forwarded-for'];
      const ipHeader = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      const ip = req.ip || ipHeader;
      return ip ? `ip:${ipKeyGenerator(ip)}` : 'unauthenticated';
    },
    
    // Standard rate limit headers
    standardHeaders: true,
    legacyHeaders: false,
    
    // Custom error message
    message: {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    },
    
    // Skip rate limiting for health checks
    skip: (req) => req.path === '/health',
  });
}
