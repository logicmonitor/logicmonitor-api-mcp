/**
 * Request ID middleware
 * Adds unique request ID to each request for tracking
 */

import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Create request ID middleware
 */
export function createRequestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Use existing request ID from header, or generate new one
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    next();
  };
}

