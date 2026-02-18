/**
 * Test client wrapper for MCP server
 * Uses InMemoryTransport for proper SDK-based testing
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, ServerConfig } from '../../src/server.js';
import { SessionManager } from '../../src/session/sessionManager.js';
import winston from 'winston';

export interface ToolCallResult {
  success: boolean;
  content: Array<{ type: string; text: string }>;
  data?: unknown;
  error?: string;
  isError?: boolean;
}

export class TestMCPClient {
  private client!: Client;
  private sessionManager: SessionManager;
  private sessionId: string;
  private logger: winston.Logger;
  private _credentials: { lmAccount: string; lmBearerToken: string };

  constructor(
    lmAccount: string,
    lmBearerToken: string,
    sessionId: string = 'test-session'
  ) {
    this.sessionId = sessionId;
    this.sessionManager = new SessionManager();
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'error',
      format: winston.format.json(),
      transports: [new winston.transports.Console({ silent: process.env.LOG_LEVEL !== 'debug' })],
    });

    this._credentials = {
      lmAccount,
      lmBearerToken,
    };
  }

  async init(): Promise<void> {
    const config: ServerConfig = {
      credentials: {
        lm_account: this._credentials.lmAccount,
        lm_bearer_token: this._credentials.lmBearerToken,
      },
      sessionManager: this.sessionManager,
      logger: this.logger,
    };

    const { server: mcpServer } = await createServer(config);

    // Create linked in-memory transports
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    serverTransport.sessionId = this.sessionId;

    // Connect server and client via in-memory transports
    await mcpServer.server.connect(serverTransport);

    this.client = new Client({ name: 'test-client', version: '1.0.0' });
    await this.client.connect(clientTransport);
  }

  /**
   * Call a tool and return the parsed result
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      const content = (response.content || []) as Array<{ type: string; text: string }>;
      let data: unknown = undefined;

      for (const block of content) {
        if (block.type !== 'text' || typeof block.text !== 'string') continue;
        if (!block.text.trim()) continue;

        // Try direct JSON parse first
        try {
          data = JSON.parse(block.text);
          break;
        } catch {
          // buildToolResponse wraps JSON as "Full LogicMonitor payload:\n{...}"
          const payloadPrefix = 'Full LogicMonitor payload:\n';
          if (block.text.startsWith(payloadPrefix)) {
            try {
              data = JSON.parse(block.text.slice(payloadPrefix.length));
              break;
            } catch { /* not JSON payload */ }
          }
          if (typeof data === 'undefined') {
            data = block.text;
          }
        }
      }

      if (typeof data === 'undefined' && content.length > 0 && content[0].type === 'text') {
        data = content[0].text;
      }

      // Extract error message from isError responses
      const isError = response.isError as boolean | undefined;
      let error: string | undefined;
      if (isError && content.length > 0 && content[0].type === 'text') {
        error = content[0].text;
      }

      return {
        success: !isError,
        content,
        data,
        error,
        isError,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        content: [],
        error: message,
      };
    }
  }

  /**
   * Get session context
   */
  getSessionContext() {
    return this.sessionManager.getSnapshot(this.sessionId);
  }

  /**
   * Clear session context
   */
  clearSession() {
    this.sessionManager.clear(this.sessionId, 'all');
  }

  /**
   * Get a session variable
   */
  getSessionVariable(key: string) {
    return this.sessionManager.getVariable(this.sessionId, key);
  }

  /**
   * Set a session variable
   */
  setSessionVariable(key: string, value: unknown) {
    return this.sessionManager.setVariable(this.sessionId, key, value);
  }

  /**
   * Close the client connection
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}

/**
 * Create a test client instance
 */
export async function createTestClient(sessionId?: string): Promise<TestMCPClient> {
  const client = new TestMCPClient(
    global.testConfig.lmAccount,
    global.testConfig.lmBearerToken,
    sessionId
  );
  
  await client.init();
  return client;
}
