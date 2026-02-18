/**
 * No-auth mode - no authentication required
 * Used for STDIO transport or trusted environments
 */

import type { AuthValidator, AuthResult } from './types.js';
import type { CredentialMapper } from './credentialMapper.js';

export class NoneAuthValidator implements AuthValidator {
  constructor(private credentialMapper: CredentialMapper) {}

  async validate(_token: string): Promise<AuthResult> {
    // No authentication - use default credentials
    const credentials = this.credentialMapper.getDefaultCredentials();
    
    if (!credentials) {
      return {
        success: false,
        error: 'No default LogicMonitor credentials configured',
      };
    }

    return {
      success: true,
      clientId: 'anonymous',
      credentials,
    };
  }
}

