/**
 * Express middleware for authentication
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthManager } from './index.js';
import type { AuthContext } from './types.js';
import type { LMCredentials } from './credentialMapper.js';

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
 * 
 * Credential resolution order (highest to lowest priority):
 * 1. X-LM-Account + X-LM-Bearer-Token headers (per-request override)
 * 2. AUTH_CREDENTIAL_MAPPING (maps clientId to LM credentials)
 * 3. LM_ACCOUNT + LM_BEARER_TOKEN (default fallback)
 */
export function createAuthMiddleware(authManager: AuthManager) {
  const extractHeader = (value?: string | string[]): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const getLmCredentialsFromHeaders = (req: Request): { credentials?: LMCredentials; error?: string } => {
    const account = extractHeader(req.headers['x-lm-account']);
    const token = extractHeader(req.headers['x-lm-bearer-token']);

    if ((account && !token) || (!account && token)) {
      return { error: 'Both X-LM-Account and X-LM-Bearer-Token headers are required together.' };
    }

    if (account && token) {
      return {
        credentials: {
          lm_account: account,
          lm_bearer_token: token
        }
      };
    }

    return {};
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const { credentials: headerCredentials, error: headerError } = getLmCredentialsFromHeaders(req);
    if (headerError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: headerError
      });
    }

    // Skip auth for health check
    if (req.path === '/health') {
      return next();
    }

    // For 'none' mode, create anonymous context
    if (!authManager.isAuthRequired()) {
      const result = await authManager.authenticate();
      if (result.success) {
        const context = authManager.createContext(result) || undefined;
        if (context) {
          if (headerCredentials) {
            context.credentials = headerCredentials;
          }
          req.auth = context;
          return next();
        }
      }

      // Allow header-provided credentials even if default credentials are missing
      if (headerCredentials) {
        req.auth = {
          clientId: 'anonymous',
          authMode: 'none',
          credentials: headerCredentials
        };
        return next();
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'LogicMonitor credentials are required'
      });
    }

    // For bearer mode, require Authorization header
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
    
    // If no context from auth result, we need header credentials
    if (!authContext) {
      if (!headerCredentials) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'LogicMonitor credentials are required. Provide them via credential mapping or X-LM-Account/X-LM-Bearer-Token headers.',
        });
      }
      
      // Create context with header credentials
      req.auth = {
        clientId: result.clientId || 'unknown',
        authMode: 'bearer',
        credentials: headerCredentials
      };
      return next();
    }

    // Header credentials override auth result credentials
    if (headerCredentials) {
      authContext.credentials = headerCredentials;
    }

    req.auth = authContext;
    next();
  };
}
