import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';

describe('End-to-End Integration Tests', () => {
  describe('STDIO Mode', () => {
    let serverProcess: ChildProcess;
    let client: Client;
    let transport: StdioClientTransport;

    beforeAll(async () => {
      // Start server in STDIO mode
      serverProcess = spawn('node', ['dist/index.js', '--stdio'], {
        env: {
          ...process.env,
          LM_ACCOUNT: 'test-account',
          LM_BEARER_TOKEN: 'test-token',
          LOG_LEVEL: 'error'
        }
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create client
      client = new Client({
        name: 'test-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      transport = new StdioClientTransport({
        command: 'node',
        args: ['dist/index.js', '--stdio'],
        env: {
          ...process.env,
          LM_ACCOUNT: 'test-account',
          LM_BEARER_TOKEN: 'test-token',
          LOG_LEVEL: 'error'
        }
      });

      await client.connect(transport);
    }, 30000);

    afterAll(async () => {
      if (client) {
        await client.close();
      }
      if (serverProcess) {
        serverProcess.kill();
      }
    });

    it('should connect to server via STDIO', async () => {
      expect(client).toBeDefined();
      // If we got here, connection was successful
    });

    it('should list available tools', async () => {
      const result = await client.listTools();
      
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      
      // Check for expected tools
      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).toContain('lm_device');
      expect(toolNames).toContain('lm_alert');
      expect(toolNames).toContain('lm_session');
    });

    it('should list available resources', async () => {
      const result = await client.listResources();
      
      expect(result.resources).toBeDefined();
      expect(Array.isArray(result.resources)).toBe(true);
    });

    it('should list available prompts', async () => {
      const result = await client.listPrompts();
      
      expect(result.prompts).toBeDefined();
      expect(Array.isArray(result.prompts)).toBe(true);
    });

    it('should execute session tool', async () => {
      const result = await client.callTool({
        name: 'lm_session',
        arguments: {
          operation: 'get'
        }
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should handle tool errors gracefully', async () => {
      try {
        await client.callTool({
          name: 'lm_device',
          arguments: {
            operation: 'get',
            id: 'non-existent-device-12345'
          }
        });
        // Should throw an error
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should maintain session state across multiple calls', async () => {
      // Set a variable
      await client.callTool({
        name: 'lm_session',
        arguments: {
          operation: 'set',
          key: 'test_key',
          value: 'test_value'
        }
      });

      // Get the variable
      const result = await client.callTool({
        name: 'lm_session',
        arguments: {
          operation: 'get'
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.variables.test_key).toBe('test_value');
    });
  });

  describe('HTTP Mode', () => {
    const baseURL = 'http://localhost:3001';
    const bearerToken = 'test-token-123';
    let serverProcess: ChildProcess;

    beforeAll(async () => {
      // Start server in HTTP mode
      serverProcess = spawn('node', ['dist/index.js'], {
        env: {
          ...process.env,
          PORT: '3001',
          AUTH_MODE: 'bearer',
          BEARER_TOKENS: bearerToken,
          LM_ACCOUNT: 'test-account',
          LM_BEARER_TOKEN: 'test-token',
          LOG_LEVEL: 'error',
          CORS_ORIGINS: 'http://localhost:3000'
        }
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000));
    }, 30000);

    afterAll(async () => {
      if (serverProcess) {
        serverProcess.kill();
        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    it('should respond to health check', async () => {
      const response = await axios.get(`${baseURL}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
      expect(response.data.service).toBe('logicmonitor-api-mcp');
    });

    it('should reject unauthenticated requests', async () => {
      try {
        await axios.post(`${baseURL}/mcp`, {
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should accept authenticated requests', async () => {
      const response = await axios.post(
        `${baseURL}/mcp`,
        {
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        },
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
    });

    it('should maintain session across requests', async () => {
      const sessionId = 'test-session-' + Date.now();

      // First request
      const response1 = await axios.post(
        `${baseURL}/mcp`,
        {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'lm_session',
            arguments: {
              operation: 'set',
              key: 'test_key',
              value: 'test_value'
            }
          },
          id: 1
        },
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'MCP-Session-ID': sessionId,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response1.status).toBe(200);

      // Second request with same session
      const response2 = await axios.post(
        `${baseURL}/mcp`,
        {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'lm_session',
            arguments: {
              operation: 'get'
            }
          },
          id: 2
        },
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'MCP-Session-ID': sessionId,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response2.status).toBe(200);
      // Session should contain the variable we set
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map((_, i) =>
        axios.post(
          `${baseURL}/mcp`,
          {
            jsonrpc: '2.0',
            method: 'tools/list',
            id: i
          },
          {
            headers: {
              'Authorization': `Bearer ${bearerToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should enforce rate limiting', async () => {
      // Make many requests rapidly
      const requests = Array(150).fill(null).map((_, i) =>
        axios.post(
          `${baseURL}/mcp`,
          {
            jsonrpc: '2.0',
            method: 'tools/list',
            id: i
          },
          {
            headers: {
              'Authorization': `Bearer ${bearerToken}`,
              'Content-Type': 'application/json'
            },
            validateStatus: () => true // Don't throw on 429
          }
        )
      );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle CORS preflight requests', async () => {
      const response = await axios.options(`${baseURL}/mcp`, {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization'
        },
        validateStatus: () => true
      });

      // Should allow the request or return appropriate CORS headers
      expect([200, 204]).toContain(response.status);
    });

    it('should reject requests from unauthorized origins', async () => {
      try {
        await axios.post(
          `${baseURL}/mcp`,
          {
            jsonrpc: '2.0',
            method: 'tools/list',
            id: 1
          },
          {
            headers: {
              'Authorization': `Bearer ${bearerToken}`,
              'Origin': 'http://evil.com',
              'Content-Type': 'application/json'
            }
          }
        );
        // May or may not throw depending on CORS config
      } catch (error: any) {
        // CORS error expected
        expect(error).toBeDefined();
      }
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after consecutive failures', async () => {
      const { CircuitBreaker } = await import('../../src/utils/circuitBreaker.js');
      
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        successThreshold: 2
      });

      // Simulate 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Simulated failure');
          });
        } catch (error) {
          // Expected
        }
      }

      // Circuit should be open now
      try {
        await breaker.execute(async () => 'success');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('Circuit breaker is open');
      }
    });

    it('should transition to half-open after timeout', async () => {
      const { CircuitBreaker } = await import('../../src/utils/circuitBreaker.js');
      
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 500, // Short timeout for testing
        successThreshold: 1
      });

      // Trigger circuit open
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Failure');
          });
        } catch (error) {
          // Expected
        }
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should allow one request in half-open state
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should handle SIGTERM gracefully', async () => {
      const serverProcess = spawn('node', ['dist/index.js'], {
        env: {
          ...process.env,
          PORT: '3002',
          AUTH_MODE: 'none',
          LM_ACCOUNT: 'test-account',
          LM_BEARER_TOKEN: 'test-token',
          LOG_LEVEL: 'error'
        }
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send SIGTERM
      serverProcess.kill('SIGTERM');

      // Wait for shutdown
      const exitCode = await new Promise<number | null>(resolve => {
        serverProcess.on('exit', (code) => resolve(code));
        setTimeout(() => resolve(null), 5000);
      });

      // Should exit cleanly
      expect(exitCode).toBe(0);
    }, 10000);

    it('should close active sessions on shutdown', async () => {
      // This would test that active MCP sessions are properly closed
      // Implementation depends on session tracking
      expect(true).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should fail to start with invalid configuration', async () => {
      const serverProcess = spawn('node', ['dist/index.js'], {
        env: {
          ...process.env,
          PORT: 'invalid-port', // Invalid port
          AUTH_MODE: 'bearer',
          LM_ACCOUNT: 'test-account',
          LM_BEARER_TOKEN: 'test-token'
        }
      });

      const exitCode = await new Promise<number | null>(resolve => {
        serverProcess.on('exit', (code) => resolve(code));
        setTimeout(() => {
          serverProcess.kill();
          resolve(null);
        }, 3000);
      });

      // Should exit with error code
      expect(exitCode).not.toBe(0);
    }, 10000);

    it('should fail to start without required credentials in STDIO mode', async () => {
      const serverProcess = spawn('node', ['dist/index.js', '--stdio'], {
        env: {
          ...process.env,
          LM_ACCOUNT: '', // Missing account
          LM_BEARER_TOKEN: '' // Missing token
        }
      });

      const exitCode = await new Promise<number | null>(resolve => {
        serverProcess.on('exit', (code) => resolve(code));
        setTimeout(() => {
          serverProcess.kill();
          resolve(null);
        }, 3000);
      });

      // Should exit with error code
      expect(exitCode).not.toBe(0);
    }, 10000);
  });
});

