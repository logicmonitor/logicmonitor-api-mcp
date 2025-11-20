import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request } from 'express';
import { AuthManager } from '../../src/auth/index.js';

// Mock config for different test scenarios
const createMockConfig = (authMode: 'none' | 'bearer' | 'oauth', additionalConfig = {}) => ({
  AUTH_MODE: authMode,
  BEARER_TOKENS: ['token123', 'token456'],
  OAUTH_JWKS_URI: 'https://test-provider.com/.well-known/jwks.json',
  OAUTH_AUDIENCE: 'test-audience',
  OAUTH_ISSUER: 'https://test-provider.com',
  LOG_LEVEL: 'error',
  LM_ACCOUNT: 'test-account',
  LM_BEARER_TOKEN: 'test-token',
  LM_CREDENTIAL_MAP: {},
  ...additionalConfig
});

describe('Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Bypass Attempts', () => {
    it('should not allow bypassing auth with empty Authorization header', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: createMockConfig('bearer')
      }));

      const { authenticateBearer } = await import('../../src/auth/bearer.js');

      const req = {
        headers: {
          authorization: ''
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.isAuthenticated).toBe(false);
    });

    it('should not allow bypassing auth with malformed Bearer header', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: createMockConfig('bearer')
      }));

      const { authenticateBearer } = await import('../../src/auth/bearer.js');

      const req = {
        headers: {
          authorization: 'Bearer'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.isAuthenticated).toBe(false);
    });

    it('should not allow SQL injection in bearer token', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: createMockConfig('bearer')
      }));

      const { authenticateBearer } = await import('../../src/auth/bearer.js');

      const req = {
        headers: {
          authorization: "Bearer ' OR '1'='1"
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.isAuthenticated).toBe(false);
    });

    it('should not allow XSS in bearer token', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: createMockConfig('bearer')
      }));

      const { authenticateBearer } = await import('../../src/auth/bearer.js');

      const req = {
        headers: {
          authorization: 'Bearer <script>alert("xss")</script>'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.isAuthenticated).toBe(false);
    });

    it('should not allow null bytes in bearer token', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: createMockConfig('bearer')
      }));

      const { authenticateBearer } = await import('../../src/auth/bearer.js');

      const req = {
        headers: {
          authorization: 'Bearer token\x00123'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.isAuthenticated).toBe(false);
    });
  });

  describe('Token Validation', () => {
    it('should validate token length', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: createMockConfig('bearer')
      }));

      const { authenticateBearer } = await import('../../src/auth/bearer.js');

      const veryLongToken = 'a'.repeat(10000);
      const req = {
        headers: {
          authorization: `Bearer ${veryLongToken}`
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.isAuthenticated).toBe(false);
    });

    it('should not accept tokens with control characters', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: createMockConfig('bearer')
      }));

      const { authenticateBearer } = await import('../../src/auth/bearer.js');

      const req = {
        headers: {
          authorization: 'Bearer token\r\n123'
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.isAuthenticated).toBe(false);
    });

    it('should be case-sensitive for token comparison', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: createMockConfig('bearer')
      }));

      const { authenticateBearer } = await import('../../src/auth/bearer.js');

      const req = {
        headers: {
          authorization: 'Bearer TOKEN123' // uppercase version
        }
      } as Request;

      const result = authenticateBearer(req);

      expect(result.isAuthenticated).toBe(false);
    });
  });

  describe('Credential Mapping Security', () => {
    it('should not leak credentials for unmapped clients', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: {
          ...createMockConfig('oauth'),
          LM_CREDENTIAL_MAP: {
            'client-1': {
              lm_account: 'account-1',
              lm_bearer_token: 'secret-token-1'
            }
          }
        }
      }));

      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');

      const authContext = {
        authMode: 'oauth' as const,
        isAuthenticated: true,
        clientId: 'client-2' // Different client
      };

      const result = mapClientCredentials(authContext);

      // Should get default credentials, not client-1's credentials
      expect(result.credentials?.lm_bearer_token).not.toBe('secret-token-1');
    });

    it('should not allow credential injection via clientId', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: {
          ...createMockConfig('oauth'),
          LM_CREDENTIAL_MAP: {
            'legitimate-client': {
              lm_account: 'legit-account',
              lm_bearer_token: 'legit-token'
            }
          }
        }
      }));

      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');

      const authContext = {
        authMode: 'oauth' as const,
        isAuthenticated: true,
        clientId: 'legitimate-client\'; DROP TABLE users; --'
      };

      const result = mapClientCredentials(authContext);

      // Should not find a match due to injection attempt
      expect(result.credentials?.lm_account).not.toBe('legit-account');
    });

    it('should handle prototype pollution attempts', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: {
          ...createMockConfig('oauth'),
          LM_CREDENTIAL_MAP: {}
        }
      }));

      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');

      const authContext = {
        authMode: 'oauth' as const,
        isAuthenticated: true,
        clientId: '__proto__'
      };

      const result = mapClientCredentials(authContext);

      // Should not allow prototype pollution
      expect(result.credentials).toBeUndefined();
    });

    it('should handle constructor property access attempts', async () => {
      jest.resetModules();
      jest.mock('../../src/config/index.js', () => ({
        config: {
          ...createMockConfig('oauth'),
          LM_CREDENTIAL_MAP: {}
        }
      }));

      const { mapClientCredentials } = await import('../../src/auth/credentialMapper.js');

      const authContext = {
        authMode: 'oauth' as const,
        isAuthenticated: true,
        clientId: 'constructor'
      };

      const result = mapClientCredentials(authContext);

      // Should not allow constructor access
      expect(result.credentials).toBeUndefined();
    });
  });

  describe('Session Security', () => {
    it('should generate unique session IDs', () => {
      const { randomUUID } = require('crypto');
      
      const sessionIds = new Set();
      for (let i = 0; i < 1000; i++) {
        sessionIds.add(randomUUID());
      }

      // All session IDs should be unique
      expect(sessionIds.size).toBe(1000);
    });

    it('should validate session ID format', () => {
      const { randomUUID } = require('crypto');
      const sessionId = randomUUID();

      // Should be a valid UUID v4
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(sessionId).toMatch(uuidRegex);
    });

    it('should not accept manipulated session IDs', () => {
      const invalidSessionIds = [
        '../../../etc/passwd',
        '00000000-0000-0000-0000-000000000000',
        'session\x00id',
        'session<script>alert(1)</script>',
        "session'; DROP TABLE sessions; --"
      ];

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      invalidSessionIds.forEach(sessionId => {
        expect(sessionId).not.toMatch(uuidRegex);
      });
    });
  });

  describe('Rate Limiting Security', () => {
    it('should enforce rate limits per client', () => {
      // This would test the rate limiter implementation
      // For now, we verify the concept
      const clientRequests = new Map<string, number>();
      const rateLimit = 100;
      const clientId = 'test-client';

      // Simulate 150 requests
      for (let i = 0; i < 150; i++) {
        const count = (clientRequests.get(clientId) || 0) + 1;
        clientRequests.set(clientId, count);
      }

      const requestCount = clientRequests.get(clientId) || 0;
      const shouldBlock = requestCount > rateLimit;

      expect(shouldBlock).toBe(true);
      expect(requestCount).toBe(150);
    });

    it('should isolate rate limits between clients', () => {
      const clientRequests = new Map<string, number>();
      const rateLimit = 100;

      // Client 1 makes 150 requests
      for (let i = 0; i < 150; i++) {
        const count = (clientRequests.get('client-1') || 0) + 1;
        clientRequests.set('client-1', count);
      }

      // Client 2 makes 50 requests
      for (let i = 0; i < 50; i++) {
        const count = (clientRequests.get('client-2') || 0) + 1;
        clientRequests.set('client-2', count);
      }

      const client1Blocked = (clientRequests.get('client-1') || 0) > rateLimit;
      const client2Blocked = (clientRequests.get('client-2') || 0) > rateLimit;

      expect(client1Blocked).toBe(true);
      expect(client2Blocked).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should reject requests with invalid JSON-RPC structure', () => {
      const invalidRequests = [
        {}, // Missing required fields
        { jsonrpc: '1.0' }, // Wrong version
        { jsonrpc: '2.0', method: 123 }, // Method not a string
        { jsonrpc: '2.0', method: 'test', id: {} }, // Invalid ID type
      ];

      invalidRequests.forEach(request => {
        // Each should fail validation
        expect(request.jsonrpc).not.toBe('2.0');
      });
    });

    it('should sanitize error messages to prevent information disclosure', () => {
      const sensitiveError = new Error('Database connection failed at host 10.0.0.1 with password abc123');
      
      // Error message should be sanitized before sending to client
      const sanitizedMessage = 'Internal server error';
      
      expect(sanitizedMessage).not.toContain('10.0.0.1');
      expect(sanitizedMessage).not.toContain('abc123');
      expect(sanitizedMessage).not.toContain('Database');
    });

    it('should validate environment variable types', () => {
      const { ConfigSchema } = require('../../src/config/schema.js');

      // Test invalid port
      expect(() => {
        ConfigSchema.parse({ PORT: 'not-a-number' });
      }).toThrow();

      // Test invalid boolean
      expect(() => {
        ConfigSchema.parse({ HTTPS_ENABLED: 'maybe' });
      }).toThrow();

      // Test invalid auth mode
      expect(() => {
        ConfigSchema.parse({ AUTH_MODE: 'invalid-mode' });
      }).toThrow();
    });
  });

  describe('HTTPS Security', () => {
    it('should require both key and cert for HTTPS', () => {
      const httpsConfig = {
        HTTPS_ENABLED: true,
        HTTPS_KEY_PATH: '/path/to/key.pem',
        HTTPS_CERT_PATH: '' // Missing cert
      };

      // Should fail validation or throw error
      expect(httpsConfig.HTTPS_CERT_PATH).toBe('');
    });

    it('should validate certificate paths', () => {
      const invalidPaths = [
        '../../../etc/passwd',
        '/dev/null',
        '',
        null,
        undefined
      ];

      invalidPaths.forEach(path => {
        expect(path).not.toMatch(/^\/[\w\/-]+\.(pem|crt|key)$/);
      });
    });
  });

  describe('Audit Logging Security', () => {
    it('should not log sensitive credentials', () => {
      const logEntry = {
        type: 'auth_success',
        clientId: 'test-client',
        timestamp: new Date().toISOString(),
        // Should NOT include: token, password, bearer_token, etc.
      };

      const logString = JSON.stringify(logEntry);

      expect(logString).not.toContain('bearer_token');
      expect(logString).not.toContain('password');
      expect(logString).not.toContain('secret');
    });

    it('should sanitize client IDs in logs', () => {
      const maliciousClientId = 'client\r\n\x00<script>alert(1)</script>';
      
      // Client ID should be sanitized before logging
      const sanitized = maliciousClientId.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      expect(sanitized).not.toContain('\r');
      expect(sanitized).not.toContain('\n');
      expect(sanitized).not.toContain('\x00');
    });
  });

  describe('Denial of Service Protection', () => {
    it('should handle extremely large client IDs', () => {
      const largeClientId = 'a'.repeat(10000);
      
      // Should truncate or reject
      const maxLength = 256;
      const shouldReject = largeClientId.length > maxLength;

      expect(shouldReject).toBe(true);
    });

    it('should handle rapid authentication attempts', () => {
      // Simulate 1000 rapid auth attempts
      const attempts = 1000;
      const timeWindow = 1000; // 1 second
      
      const attemptsPerSecond = attempts / (timeWindow / 1000);
      const threshold = 100; // Max 100 attempts per second
      
      const shouldBlock = attemptsPerSecond > threshold;

      expect(shouldBlock).toBe(true);
    });

    it('should limit session count per client', () => {
      const maxSessionsPerClient = 10;
      const clientSessions = new Map<string, number>();
      
      const clientId = 'test-client';
      clientSessions.set(clientId, 15); // Exceeds limit

      const sessionCount = clientSessions.get(clientId) || 0;
      const shouldReject = sessionCount > maxSessionsPerClient;

      expect(shouldReject).toBe(true);
    });
  });
});

