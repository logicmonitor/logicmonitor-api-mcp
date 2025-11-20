import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request } from 'express';
import { authenticateOAuth } from '../../src/auth/oauth.js';
import { AuthContext } from '../../src/auth/types.js';
import * as jose from 'jose';

// Mock the config module
jest.mock('../../src/config/index.js', () => ({
  config: {
    AUTH_MODE: 'oauth',
    OAUTH_JWKS_URI: 'https://test-provider.com/.well-known/jwks.json',
    OAUTH_AUDIENCE: 'test-audience',
    OAUTH_ISSUER: 'https://test-provider.com',
    LOG_LEVEL: 'error',
    LM_ACCOUNT: 'test-account',
    LM_BEARER_TOKEN: 'test-token',
    LM_CREDENTIAL_MAP: {}
  }
}));

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    json: jest.fn(),
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));

// Mock jose library
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn()
}));

describe('OAuth Authentication', () => {
  const mockJWKS = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (jose.createRemoteJWKSet as jest.MockedFunction<typeof jose.createRemoteJWKSet>).mockReturnValue(mockJWKS as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('authenticateOAuth', () => {
    it('should successfully authenticate with valid JWT', async () => {
      const mockPayload = {
        sub: 'user@example.com',
        aud: 'test-audience',
        iss: 'https://test-provider.com',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'RS256' }
      } as any);

      const req = {
        headers: {
          authorization: 'Bearer valid.jwt.token'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(true);
      expect(result.clientId).toBe('user@example.com');
      expect(result.token).toBe('valid.jwt.token');
    });

    it('should fail authentication when Authorization header is missing', async () => {
      const req = {
        headers: {}
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
      expect(result.clientId).toBeUndefined();
    });

    it('should fail authentication when Authorization header does not start with Bearer', async () => {
      const req = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
      expect(result.clientId).toBeUndefined();
    });

    it('should fail authentication when JWT verification fails', async () => {
      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockRejectedValue(
        new Error('JWT verification failed')
      );

      const req = {
        headers: {
          authorization: 'Bearer invalid.jwt.token'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
      expect(result.clientId).toBeUndefined();
    });

    it('should fail authentication when JWT payload is missing sub claim', async () => {
      const mockPayload = {
        aud: 'test-audience',
        iss: 'https://test-provider.com',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'RS256' }
      } as any);

      const req = {
        headers: {
          authorization: 'Bearer token.without.sub'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
      expect(result.clientId).toBeUndefined();
    });

    it('should fail authentication when JWT is expired', async () => {
      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockRejectedValue(
        new Error('JWT expired')
      );

      const req = {
        headers: {
          authorization: 'Bearer expired.jwt.token'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should fail authentication when JWT audience does not match', async () => {
      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockRejectedValue(
        new Error('Audience mismatch')
      );

      const req = {
        headers: {
          authorization: 'Bearer wrong.audience.token'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should fail authentication when JWT issuer does not match', async () => {
      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockRejectedValue(
        new Error('Issuer mismatch')
      );

      const req = {
        headers: {
          authorization: 'Bearer wrong.issuer.token'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should handle JWT with additional claims', async () => {
      const mockPayload = {
        sub: 'user@example.com',
        aud: 'test-audience',
        iss: 'https://test-provider.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email: 'user@example.com',
        name: 'Test User',
        roles: ['admin', 'user']
      };

      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'RS256' }
      } as any);

      const req = {
        headers: {
          authorization: 'Bearer token.with.claims'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(true);
      expect(result.clientId).toBe('user@example.com');
    });

    it('should handle JWKS fetch failure gracefully', async () => {
      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockRejectedValue(
        new Error('Failed to fetch JWKS')
      );

      const req = {
        headers: {
          authorization: 'Bearer valid.jwt.token'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
    });
  });

  describe('OAuth with Credential Mapping', () => {
    it('should map OAuth client to specific LM credentials', async () => {
      // This test would require mocking the credentialMapper
      // For now, we verify the auth context structure
      const mockPayload = {
        sub: 'service-account@example.com',
        aud: 'test-audience',
        iss: 'https://test-provider.com',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockResolvedValue({
        payload: mockPayload,
        protectedHeader: { alg: 'RS256' }
      } as any);

      const req = {
        headers: {
          authorization: 'Bearer service.account.token'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(true);
      expect(result.clientId).toBe('service-account@example.com');
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JWT gracefully', async () => {
      (jose.jwtVerify as jest.MockedFunction<typeof jose.jwtVerify>).mockRejectedValue(
        new Error('Malformed JWT')
      );

      const req = {
        headers: {
          authorization: 'Bearer not.a.valid.jwt.format'
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should handle empty bearer token', async () => {
      const req = {
        headers: {
          authorization: 'Bearer '
        }
      } as Request;

      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should handle whitespace in authorization header', async () => {
      const req = {
        headers: {
          authorization: '  Bearer   token.with.spaces  '
        }
      } as Request;

      // The current implementation splits on space, so this would fail
      const result = await authenticateOAuth(req);

      expect(result.authMode).toBe('oauth');
      expect(result.isAuthenticated).toBe(false);
    });
  });
});

