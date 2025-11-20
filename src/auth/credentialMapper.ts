/**
 * Credential mapper - maps authentication identities to LogicMonitor credentials
 */

import type { Config } from '../config/schema.js';

export interface LMCredentials {
  lm_account: string;
  lm_bearer_token: string;
}

export class CredentialMapper {
  private mapping: Map<string, LMCredentials>;
  private wildcardCredentials?: LMCredentials;
  private defaultCredentials?: LMCredentials;

  constructor(config: Config) {
    this.mapping = new Map();

    // Load credential mapping from config
    if (config.auth.credentialMapping) {
      for (const [key, value] of Object.entries(config.auth.credentialMapping)) {
        if (key === '*') {
          this.wildcardCredentials = {
            lm_account: value.account,
            lm_bearer_token: value.token,
          };
        } else {
          this.mapping.set(key, {
            lm_account: value.account,
            lm_bearer_token: value.token,
          });
        }
      }
    }

    // Set default credentials from environment
    if (config.logicMonitor.account && config.logicMonitor.bearerToken) {
      this.defaultCredentials = {
        lm_account: config.logicMonitor.account,
        lm_bearer_token: config.logicMonitor.bearerToken,
      };
    }
  }

  /**
   * Get LogicMonitor credentials for an authenticated client
   */
  getCredentials(clientId: string): LMCredentials | undefined {
    // 1. Try exact match
    const mapped = this.mapping.get(clientId);
    if (mapped) {
      return mapped;
    }

    // 2. Try wildcard
    if (this.wildcardCredentials) {
      return this.wildcardCredentials;
    }

    // 3. Fall back to default
    return this.defaultCredentials;
  }

  /**
   * Check if credentials are available for a client
   */
  hasCredentials(clientId: string): boolean {
    return this.getCredentials(clientId) !== undefined;
  }

  /**
   * Get default credentials (for backward compatibility)
   */
  getDefaultCredentials(): LMCredentials | undefined {
    return this.defaultCredentials;
  }
}

