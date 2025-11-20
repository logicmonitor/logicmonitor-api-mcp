/**
 * Express middleware for authentication
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthManager } from './index.js';
import type { AuthContext } from './types.js';

// Extend Express Request type to include auth context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(authManager: AuthManager) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for health check
    if (req.path === '/health') {
      return next();
    }

    // For 'none' mode, create anonymous context
    if (!authManager.isAuthRequired()) {
      const result = await authManager.authenticate();
      if (result.success) {
        req.auth = authManager.createContext(result) || undefined;
      }
      return next();
    }

    // For bearer/oauth modes, require Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization header is required',
      });
    }

    // Authenticate
    const result = await authManager.authenticate(authHeader);
    
    if (!result.success) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: result.error || 'Authentication failed',
      });
    }

    // Create and attach auth context
    const authContext = authManager.createContext(result);
    if (!authContext) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create auth context',
      });
    }

    req.auth = authContext;
    next();
  };
}

