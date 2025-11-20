/**
 * CORS middleware configuration
 */

import type { Request, Response, NextFunction } from 'express';
import type { Config } from '../config/schema.js';

/**
 * Create CORS middleware
 */
export function createCorsMiddleware(config: Config) {
  const allowedOrigins = new Set(config.security.corsOrigins);
  const corsEnabled = config.security.corsEnabled;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!corsEnabled) {
      return next();
    }

    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin && (allowedOrigins.has(origin) || allowedOrigins.has('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Session-ID, X-LM-Account, X-LM-Bearer-Token');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      return res.status(204).end();
    }

    next();
  };
}

