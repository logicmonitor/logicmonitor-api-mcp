/**
 * OAuth authentication
 * Validates JWT tokens from external OAuth providers using JWKS
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AuthValidator, AuthResult } from './types.js';
import type { CredentialMapper } from './credentialMapper.js';
import type { Config } from '../config/schema.js';

export class OAuthValidator implements AuthValidator {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private audience: string;
  private issuer: string;
  private requiredScopes?: string[];

  constructor(
    config: Config,
    private credentialMapper: CredentialMapper
  ) {
    if (!config.auth.oauth?.jwksUrl) {
      throw new Error('OAUTH_JWKS_URL is required for OAuth mode');
    }
    if (!config.auth.oauth?.audience) {
      throw new Error('OAUTH_AUDIENCE is required for OAuth mode');
    }
    if (!config.auth.oauth?.issuer) {
      throw new Error('OAUTH_ISSUER is required for OAuth mode');
    }

    this.jwks = createRemoteJWKSet(new URL(config.auth.oauth.jwksUrl));
    this.audience = config.auth.oauth.audience;
    this.issuer = config.auth.oauth.issuer;
    this.requiredScopes = config.auth.oauth.requiredScopes;
  }

  async validate(token: string): Promise<AuthResult> {
    try {
      // Verify JWT signature and claims
      const { payload } = await jwtVerify(token, this.jwks, {
        audience: this.audience,
        issuer: this.issuer,
      });

      // Check required scopes if configured
      if (this.requiredScopes && this.requiredScopes.length > 0) {
        const tokenScopes = this.extractScopes(payload);
        const hasRequiredScopes = this.requiredScopes.every(scope =>
          tokenScopes.includes(scope)
        );

        if (!hasRequiredScopes) {
          return {
            success: false,
            error: `Missing required scopes: ${this.requiredScopes.join(', ')}`,
          };
        }
      }

      // Extract client identity (prefer sub, fall back to email)
      const clientId = (payload.sub || payload.email || 'unknown') as string;

      // Get credentials for this client
      const credentials = this.credentialMapper.getCredentials(clientId);
      
      if (!credentials) {
        return {
          success: false,
          error: `No LogicMonitor credentials mapped for client: ${clientId}`,
        };
      }

      return {
        success: true,
        clientId,
        credentials,
      };
    } catch (error) {
      return {
        success: false,
        error: `JWT validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Extract scopes from JWT payload
   * Supports both space-separated string and array formats
   */
  private extractScopes(payload: JWTPayload): string[] {
    const scope = payload.scope;
    
    if (typeof scope === 'string') {
      return scope.split(' ').filter(Boolean);
    }
    
    if (Array.isArray(scope)) {
      return scope.filter(s => typeof s === 'string');
    }
    
    return [];
  }
}

