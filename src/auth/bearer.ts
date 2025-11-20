/**
 * Bearer token authentication
 * Simple static token validation
 */

import type { AuthValidator, AuthResult } from './types.js';
import type { CredentialMapper } from './credentialMapper.js';

export class BearerAuthValidator implements AuthValidator {
  private validTokens: Set<string>;

  constructor(
    tokens: string[],
    private credentialMapper: CredentialMapper
  ) {
    this.validTokens = new Set(tokens);
  }

  async validate(token: string): Promise<AuthResult> {
    if (!this.validTokens.has(token)) {
      return {
        success: false,
        error: 'Invalid bearer token',
      };
    }

    // Token is valid - get credentials
    const credentials = this.credentialMapper.getCredentials(token);
    
    if (!credentials) {
      return {
        success: false,
        error: 'No LogicMonitor credentials mapped for this token',
      };
    }

    return {
      success: true,
      clientId: token, // Use token as client ID (could be hashed for security)
      credentials,
    };
  }
}

