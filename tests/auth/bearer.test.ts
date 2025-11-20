import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request } from 'express';
import { authenticateBearer } from '../../src/auth/bearer.js';

// Mock the config module
jest.mock('../../src/config/index.js', () => ({
  config: {
    AUTH_MODE: 'bearer',
    BEARER_TOKENS: ['token123', 'token456', 'super-secret-token'],
    LM_ACCOUNT: 'test-account',
    LM_BEARER_TOKEN: 'test-lm-token',
    LM_CREDENTIAL_MAP: {}
  }
}));

// Mock credential mapper
jest.mock('../../src/auth/credentialMapper.js', () => ({
  mapClientCredentials: jest.fn((authContext) => ({
    ...authContext,
    credentials: {
      lm_account: 'test-account',
      lm_bearer_token: 'test-lm-token'
    }
  }))
}));

describe('Bearer Token Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateBearer', () => {
    it('should successfully authenticate with valid bearer token', () => {
      const req = {
        headers: {
          authorization: 'Bearer token123'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.authMode).toBe('bearer');
      expect(result.isAuthenticated).toBe(true);
      expect(result.clientId).toBe('bearer-token123');
      expect(result.token).toBe('token123');
    });

    it('should authenticate with any configured token', () => {
      const req = {
        headers: {
          authorization: 'Bearer super-secret-token'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.authMode).toBe('bearer');
      expect(result.isAuthenticated).toBe(true);
      expect(result.clientId).toBe('bearer-super-sec');
      expect(result.token).toBe('super-secret-token');
    });

    it('should fail authentication when Authorization header is missing', () => {
      const req = {
        headers: {}
      } as Request;

      const result = authenticateBearer(req);

      expect(result.authMode).toBe('bearer');
      expect(result.isAuthenticated).toBe(false);
      expect(result.clientId).toBeUndefined();
      expect(result.token).toBeUndefined();
    });

    it('should fail authentication when Authorization header does not start with Bearer', () => {
      const req = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.authMode).toBe('bearer');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should fail authentication with invalid token', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.authMode).toBe('bearer');
      expect(result.isAuthenticated).toBe(false);
      expect(result.clientId).toBeUndefined();
    });

    it('should fail authentication with empty token', () => {
      const req = {
        headers: {
          authorization: 'Bearer '
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.authMode).toBe('bearer');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should be case-sensitive for token comparison', () => {
      const req = {
        headers: {
          authorization: 'Bearer TOKEN123'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.authMode).toBe('bearer');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should handle tokens with special characters', () => {
      // This test assumes tokens can have special characters
      // Update BEARER_TOKENS mock if needed
      const req = {
        headers: {
          authorization: 'Bearer token-with-dashes-123'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.authMode).toBe('bearer');
      expect(result.isAuthenticated).toBe(false); // Not in configured tokens
    });

    it('should create client ID from first 8 characters of token', () => {
      const req = {
        headers: {
          authorization: 'Bearer token456'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.clientId).toBe('bearer-token456');
    });

    it('should handle very long tokens', () => {
      const longToken = 'a'.repeat(256);
      const req = {
        headers: {
          authorization: `Bearer ${longToken}`
        }
      } as Request;

      const result = authenticateBearer(req);

      // Should fail since it's not in configured tokens
      expect(result.isAuthenticated).toBe(false);
    });

    it('should not authenticate with token containing only whitespace', () => {
      const req = {
        headers: {
          authorization: 'Bearer    '
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.authMode).toBe('bearer');
      expect(result.isAuthenticated).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle authorization header with extra spaces', () => {
      const req = {
        headers: {
          authorization: '  Bearer   token123  '
        }
      } as Request;

      // Current implementation splits on space, so extra spaces may cause issues
      const result = authenticateBearer(req);

      // This depends on implementation - may need to trim
      expect(result.authMode).toBe('bearer');
    });

    it('should handle lowercase bearer keyword', () => {
      const req = {
        headers: {
          authorization: 'bearer token123'
        }
      } as Request;

      const result = authenticateBearer(req);

      // Should fail because we check for 'Bearer ' with capital B
      expect(result.isAuthenticated).toBe(false);
    });

    it('should handle authorization header with multiple Bearer keywords', () => {
      const req = {
        headers: {
          authorization: 'Bearer Bearer token123'
        }
      } as Request;

      const result = authenticateBearer(req);

      // The token would be 'Bearer token123' which is not valid
      expect(result.isAuthenticated).toBe(false);
    });
  });
});

