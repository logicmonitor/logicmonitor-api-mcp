/**
 * Test client wrapper for MCP server
 * Uses InMemoryTransport for proper SDK-based testing
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, ServerConfig } from '../../src/server.js';
import { SessionManager } from '../../src/session/sessionManager.js';
import winston from 'winston';
import type { LMCredentials } from '../../src/auth/lmCredentials.js';

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
  private _credentials: LMCredentials;

  constructor(
    credentials: LMCredentials,
    sessionId: string = 'test-session'
  ) {
    this.sessionId = sessionId;
    this.sessionManager = new SessionManager();
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'error',
      format: winston.format.json(),
      transports: [new winston.transports.Console({ silent: process.env.LOG_LEVEL !== 'debug' })],
    });

    this._credentials = credentials;
  }

  async init(): Promise<void> {
    const config: ServerConfig = {
      credentials: this._credentials,
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

      // Try all content blocks for JSON data (compact responses put summary first, payload second)
      const payloadPrefix = 'Full LogicMonitor payload:\n';
      for (const block of content) {
        if (block.type !== 'text' || typeof block.text !== 'string') continue;
        if (!block.text.trim()) continue;

        // Try direct JSON parse
        try {
          data = JSON.parse(block.text);
          break;
        } catch { /* not raw JSON */ }

        // Try "Full LogicMonitor payload:\n{...}" format
        if (block.text.startsWith(payloadPrefix)) {
          try {
            data = JSON.parse(block.text.slice(payloadPrefix.length));
            break;
          } catch { /* not JSON payload */ }
        }
      }

      // For compact responses (tables, summaries), no JSON block exists.
      // Recover the full OperationResult from session's lastResults so tests
      // can assert on item structure and field presence.
      if (data === undefined || typeof data === 'string') {
        const toolResult = this.getToolResult(toolName);
        if (toolResult) {
          data = toolResult;
        } else {
          // Final fallback: use raw text
          data = content[0]?.text;
        }
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
   * Get the OperationResult for a specific tool from session lastResults.
   * This contains the full items/data regardless of response formatting.
   */
  private getToolResult(toolName: string): Record<string, unknown> | null {
    const context = this.sessionManager.getContext(this.sessionId);
    if (!context?.lastResults) return null;

    return context.lastResults[toolName] as Record<string, unknown> ?? null;
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
    {
      kind: 'bearer',
      lm_account: global.testConfig.lmAccount,
      lm_bearer_token: global.testConfig.lmBearerToken,
    },
    sessionId
  );
  
  await client.init();
  return client;
}
