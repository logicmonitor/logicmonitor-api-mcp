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

    // Token is valid - get credentials from mapping (if available)
    // Note: credentials can also be provided via X-LM-Account and X-LM-Bearer-Token headers
    // which are handled by the middleware, so we don't fail if mapping is missing
    const credentials = this.credentialMapper.getCredentials(token);

    return {
      success: true,
      clientId: token, // Use token as client ID (could be hashed for security)
      credentials,
    };
  }
}

