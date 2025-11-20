import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mapClientCredentials } from '../../src/auth/credentialMapper.js';
import { AuthContext } from '../../src/auth/types.js';

describe('Credential Mapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mapClientCredentials with no mapping', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: {
          LM_ACCOUNT: 'default-account',
          LM_BEARER_TOKEN: 'default-token',
          LM_CREDENTIAL_MAP: {}
        }
      }));
    });

    it('should return auth context unchanged when clientId is undefined', () => {
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true
      };

      const result = mapClientCredentials(authContext);

      expect(result).toEqual(authContext);
    });

    it('should use default credentials when no mapping exists', async () => {
      // Re-import to get mocked config
      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');
      
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true,
        clientId: 'unknown-client'
      };

      const result = mapClientCredentials(authContext);

      expect(result.credentials).toEqual({
        lm_account: 'default-account',
        lm_bearer_token: 'default-token'
      });
    });
  });

  describe('mapClientCredentials with mapping', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: {
          LM_ACCOUNT: 'default-account',
          LM_BEARER_TOKEN: 'default-token',
          LM_CREDENTIAL_MAP: {
            'client-1': {
              lm_account: 'account-1',
              lm_bearer_token: 'token-1'
            },
            'client-2': {
              lm_account: 'account-2',
              lm_bearer_token: 'token-2'
            },
            'service-account@company.com': {
              lm_account: 'service-account',
              lm_bearer_token: 'service-token'
            }
          }
        }
      }));
    });

    it('should map client-1 to specific credentials', async () => {
      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');
      
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true,
        clientId: 'client-1'
      };

      const result = mapClientCredentials(authContext);

      expect(result.credentials).toEqual({
        lm_account: 'account-1',
        lm_bearer_token: 'token-1'
      });
    });

    it('should map client-2 to different credentials', async () => {
      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');
      
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true,
        clientId: 'client-2'
      };

      const result = mapClientCredentials(authContext);

      expect(result.credentials).toEqual({
        lm_account: 'account-2',
        lm_bearer_token: 'token-2'
      });
    });

    it('should map email-based client ID', async () => {
      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');
      
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true,
        clientId: 'service-account@company.com'
      };

      const result = mapClientCredentials(authContext);

      expect(result.credentials).toEqual({
        lm_account: 'service-account',
        lm_bearer_token: 'service-token'
      });
    });

    it('should fall back to default for unmapped client', async () => {
      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');
      
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true,
        clientId: 'unknown-client'
      };

      const result = mapClientCredentials(authContext);

      expect(result.credentials).toEqual({
        lm_account: 'default-account',
        lm_bearer_token: 'default-token'
      });
    });

    it('should preserve other auth context properties', async () => {
      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');
      
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true,
        clientId: 'client-1',
        token: 'original-jwt-token'
      };

      const result = mapClientCredentials(authContext);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(true);
      expect(result.clientId).toBe('client-1');
      expect(result.token).toBe('original-jwt-token');
      expect(result.credentials).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: {
          LM_ACCOUNT: '',
          LM_BEARER_TOKEN: '',
          LM_CREDENTIAL_MAP: {}
        }
      }));
    });

    it('should handle missing default credentials gracefully', async () => {
      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');
      
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true,
        clientId: 'unknown-client'
      };

      const result = mapClientCredentials(authContext);

      // Should not add credentials if defaults are empty
      expect(result.credentials).toBeUndefined();
    });

    it('should handle empty clientId string', async () => {
      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');
      
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true,
        clientId: ''
      };

      const result = mapClientCredentials(authContext);

      expect(result.credentials).toBeUndefined();
    });

    it('should handle clientId with special characters', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: {
          LM_ACCOUNT: 'default-account',
          LM_BEARER_TOKEN: 'default-token',
          LM_CREDENTIAL_MAP: {
            'client-with-special-chars!@#$': {
              lm_account: 'special-account',
              lm_bearer_token: 'special-token'
            }
          }
        }
      }));

      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');
      
      const authContext: AuthContext = {
        authMode: 'oauth',
        isAuthenticated: true,
        clientId: 'client-with-special-chars!@#$'
      };

      const result = mapClientCredentials(authContext);

      expect(result.credentials).toEqual({
        lm_account: 'special-account',
        lm_bearer_token: 'special-token'
      });
    });
  });
});

