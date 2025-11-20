/**
 * Authentication manager
 * Selects and manages authentication mode
 */

import type { Config } from '../config/schema.js';
import type { AuthValidator, AuthResult, AuthContext } from './types.js';
import { CredentialMapper } from './credentialMapper.js';
import { NoneAuthValidator } from './none.js';
import { BearerAuthValidator } from './bearer.js';
import { OAuthValidator } from './oauth.js';

export class AuthManager {
  private validator: AuthValidator;
  private credentialMapper: CredentialMapper;
  private authMode: 'none' | 'bearer' | 'oauth';

  constructor(config: Config) {
    this.authMode = config.auth.mode;
    this.credentialMapper = new CredentialMapper(config);

    // Create appropriate validator based on mode
    switch (this.authMode) {
      case 'none':
        this.validator = new NoneAuthValidator(this.credentialMapper);
        break;
      
      case 'bearer':
        if (!config.auth.bearerTokens || config.auth.bearerTokens.length === 0) {
          throw new Error('MCP_BEARER_TOKENS is required when AUTH_MODE=bearer');
        }
        this.validator = new BearerAuthValidator(
          config.auth.bearerTokens,
          this.credentialMapper
        );
        break;
      
      case 'oauth':
        this.validator = new OAuthValidator(config, this.credentialMapper);
        break;
      
      default:
        throw new Error(`Unknown auth mode: ${this.authMode}`);
    }
  }

  /**
   * Authenticate a request
   * @param authHeader Authorization header value (e.g., "Bearer token123")
   * @returns Authentication result with client context
   */
  async authenticate(authHeader?: string): Promise<AuthResult> {
    // For 'none' mode, no auth header is required
    if (this.authMode === 'none') {
      return this.validator.validate('');
    }

    // For bearer and oauth modes, auth header is required
    if (!authHeader) {
      return {
        success: false,
        error: 'Authorization header is required',
      };
    }

    // Extract token from "Bearer <token>" format
    const token = this.extractToken(authHeader);
    if (!token) {
      return {
        success: false,
        error: 'Invalid Authorization header format. Expected: Bearer <token>',
      };
    }

    return this.validator.validate(token);
  }

  /**
   * Create auth context from auth result
   */
  createContext(result: AuthResult): AuthContext | null {
    if (!result.success || !result.clientId || !result.credentials) {
      return null;
    }

    return {
      clientId: result.clientId,
      authMode: this.authMode,
      credentials: result.credentials,
    };
  }

  /**
   * Get auth mode
   */
  getAuthMode(): 'none' | 'bearer' | 'oauth' {
    return this.authMode;
  }

  /**
   * Check if authentication is required for HTTP transport
   */
  isAuthRequired(): boolean {
    return this.authMode !== 'none';
  }

  /**
   * Extract token from Authorization header
   */
  private extractToken(authHeader: string): string | null {
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }
    return parts[1];
  }
}

// Export types and classes
export type { AuthResult, AuthContext, AuthValidator } from './types.js';
export { CredentialMapper } from './credentialMapper.js';
export { NoneAuthValidator } from './none.js';
export { BearerAuthValidator } from './bearer.js';
export { OAuthValidator } from './oauth.js';

