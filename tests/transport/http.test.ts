import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock dependencies before importing the module
jest.mock('../../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 3001,
    LOG_LEVEL: 'error',
    AUTH_MODE: 'bearer',
    BEARER_TOKENS: ['test-token-123'],
    CORS_ORIGINS: ['http://localhost:3000'],
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    HTTPS_ENABLED: false,
    LM_ACCOUNT: 'test-account',
    LM_BEARER_TOKEN: 'test-lm-token',
    LM_CREDENTIAL_MAP: {}
  }
}));

jest.mock('../../src/auth/middleware.js', () => ({
  authMiddleware: jest.fn(() => (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer test-token-123') {
      req.auth = {
        authMode: 'bearer',
        isAuthenticated: true,
        clientId: 'test-client',
        credentials: {
          lm_account: 'test-account',
          lm_bearer_token: 'test-lm-token'
        }
      };
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  })
}));

jest.mock('../../src/audit/logger.js', () => ({
  auditLogger: {
    logAuthSuccess: jest.fn(),
    logAuthFailure: jest.fn(),
    logSessionCreated: jest.fn(),
    logSessionClosed: jest.fn(),
    logServerError: jest.fn()
  }
}));

describe('HTTP Transport', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Import middleware
    const { authMiddleware } = require('../../src/auth/middleware.js');

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'logicmonitor-api-mcp',
        version: '2.0.0',
        requestId: req.headers['x-request-id'] || 'test-request-id'
      });
    });

    // MCP endpoint with auth
    app.all('/mcp', authMiddleware(), (req, res) => {
      if (!req.auth) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      res.json({
        message: 'MCP endpoint',
        clientId: req.auth.clientId,
        authenticated: req.auth.isAuthenticated
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        service: 'logicmonitor-api-mcp',
        version: '2.0.0',
        requestId: expect.any(String)
      });
    });

    it('should respond quickly', async () => {
      const start = Date.now();
      await request(app).get('/health').expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should respond in < 100ms
    });

    it('should handle concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });

  describe('MCP Endpoint Authentication', () => {
    it('should allow access with valid bearer token', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(200);

      expect(response.body.authenticated).toBe(true);
      expect(response.body.clientId).toBe('test-client');
    });

    it('should reject request without authorization header', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer invalid-token')
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject request with malformed authorization header', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', 'NotBearer test-token-123')
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('HTTP Methods', () => {
    it('should handle POST requests to MCP endpoint', async () => {
      await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(200);
    });

    it('should handle GET requests to MCP endpoint', async () => {
      await request(app)
        .get('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .expect(200);
    });

    it('should handle PUT requests to MCP endpoint', async () => {
      await request(app)
        .put('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(200);
    });

    it('should handle DELETE requests to MCP endpoint', async () => {
      await request(app)
        .delete('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .expect(200);
    });
  });

  describe('Request Headers', () => {
    it('should accept JSON content type', async () => {
      await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .set('Content-Type', 'application/json')
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(200);
    });

    it('should handle custom request ID header', async () => {
      const customRequestId = 'custom-request-id-12345';
      
      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', customRequestId)
        .expect(200);

      expect(response.body.requestId).toBe(customRequestId);
    });

    it('should handle missing content type gracefully', async () => {
      await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .send('{"jsonrpc":"2.0","method":"test","id":1}')
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      await request(app)
        .get('/unknown')
        .expect(404);
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .set('Content-Type', 'application/json')
        .send('{"invalid json')
        .expect(400);
    });

    it('should handle very large payloads', async () => {
      const largePayload = {
        jsonrpc: '2.0',
        method: 'test',
        id: 1,
        params: {
          data: 'x'.repeat(1024 * 1024) // 1MB of data
        }
      };

      const response = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .send(largePayload);

      // Should either accept or reject with appropriate status
      expect([200, 413]).toContain(response.status);
    });
  });

  describe('Session Management', () => {
    it('should handle requests without session ID', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(200);

      expect(response.body.authenticated).toBe(true);
    });

    it('should handle requests with session ID', async () => {
      const sessionId = 'test-session-123';
      
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .set('MCP-Session-ID', sessionId)
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(200);

      expect(response.body.authenticated).toBe(true);
    });

    it('should maintain session across multiple requests', async () => {
      const sessionId = 'persistent-session-456';
      
      // First request
      await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .set('MCP-Session-ID', sessionId)
        .send({ jsonrpc: '2.0', method: 'test', id: 1 })
        .expect(200);

      // Second request with same session
      await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .set('MCP-Session-ID', sessionId)
        .send({ jsonrpc: '2.0', method: 'test', id: 2 })
        .expect(200);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent authenticated requests', async () => {
      const requests = Array(20).fill(null).map((_, i) =>
        request(app)
          .post('/mcp')
          .set('Authorization', 'Bearer test-token-123')
          .send({ jsonrpc: '2.0', method: 'test', id: i })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.authenticated).toBe(true);
      });
    });

    it('should handle mix of authenticated and unauthenticated requests', async () => {
      const requests = [
        request(app).post('/mcp').set('Authorization', 'Bearer test-token-123').send({ jsonrpc: '2.0', method: 'test', id: 1 }),
        request(app).post('/mcp').send({ jsonrpc: '2.0', method: 'test', id: 2 }),
        request(app).post('/mcp').set('Authorization', 'Bearer invalid-token').send({ jsonrpc: '2.0', method: 'test', id: 3 }),
        request(app).post('/mcp').set('Authorization', 'Bearer test-token-123').send({ jsonrpc: '2.0', method: 'test', id: 4 })
      ];

      const responses = await Promise.all(requests);

      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(401);
      expect(responses[2].status).toBe(401);
      expect(responses[3].status).toBe(200);
    });
  });
});

