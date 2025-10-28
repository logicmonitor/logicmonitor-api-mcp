#!/usr/bin/env node

import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import winston from 'winston';
import { createServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import { APP_INFO } from './appInfo.js';
import { SessionManager } from './session/sessionManager.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Set up logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: NODE_ENV === 'development' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : winston.format.json()
    })
  ]
});

async function startHttpServer() {
  const app = express();

  // Security middleware
  app.use(helmet());
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: APP_INFO.name, version: APP_INFO.version });
  });

  type HttpSessionContext = {
    transport: StreamableHTTPServerTransport;
    server: Awaited<ReturnType<typeof createServer>>;
    credentials: {
      lm_account: string;
      lm_bearer_token: string;
    };
    sessionId?: string;
    closed: boolean;
    sessionManager: SessionManager;
  };

  const sessions = new Map<string, HttpSessionContext>();

  // Handle all MCP requests at /mcp endpoint
  app.all('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      const headerAccount = Array.isArray(req.headers['x-lm-account'])
        ? req.headers['x-lm-account'][0]
        : (req.headers['x-lm-account'] as string | undefined);
      const headerToken = Array.isArray(req.headers['x-lm-bearer-token'])
        ? req.headers['x-lm-bearer-token'][0]
        : (req.headers['x-lm-bearer-token'] as string | undefined);

      let credentials: { lm_account: string; lm_bearer_token: string } | undefined;

      if (headerAccount || headerToken) {
        if (!headerAccount || !headerToken) {
          res.status(401).json({ error: 'Both X-LM-Account and X-LM-Bearer-Token headers are required.' });
          return;
        }
        credentials = {
          lm_account: headerAccount,
          lm_bearer_token: headerToken
        };
      }

      let sessionContext: HttpSessionContext | undefined;

      if (sessionId) {
        sessionContext = sessions.get(sessionId);
        if (sessionContext?.closed) {
          sessions.delete(sessionId);
          sessionContext = undefined;
        }
        if (sessionContext) {
          if (credentials) {
            const credsMatch =
              sessionContext.credentials.lm_account === credentials.lm_account &&
              sessionContext.credentials.lm_bearer_token === credentials.lm_bearer_token;

            if (!credsMatch) {
              res.status(403).json({ error: 'Credential mismatch for existing MCP session.' });
              return;
            }
          } else {
            credentials = sessionContext.credentials;
          }
        }
      }

      if (!credentials) {
        const envAccount = process.env.LM_ACCOUNT;
        const envToken = process.env.LM_BEARER_TOKEN;
        if (envAccount && envToken) {
          credentials = {
            lm_account: envAccount,
            lm_bearer_token: envToken
          };
        }
      }

      if (!credentials) {
        res.status(401).json({ error: 'LogicMonitor credentials are required via headers or environment variables.' });
        return;
      }

      if (!sessionContext) {
        let contextRef: HttpSessionContext;
        let closeSession: (reason: string) => Promise<void>;

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            contextRef.sessionId = newSessionId;
            sessions.set(newSessionId, contextRef);
            logger.info(`Session initialized: ${newSessionId}`);
          },
          onsessionclosed: async (closedSessionId) => {
            await closeSession(`session closed request (${closedSessionId})`);
          }
        });

        const mcpServer = await createServer({
          logger,
          credentials
        });

        const sessionManager =
          ((mcpServer as unknown) as { sessionManager?: SessionManager }).sessionManager ??
          new SessionManager();

        contextRef = {
          transport,
          server: mcpServer,
          credentials,
          closed: false,
          sessionManager
        };

        closeSession = async (reason: string) => {
          if (contextRef.closed) {
            return;
          }
          contextRef.closed = true;

          if (contextRef.sessionId) {
            sessions.delete(contextRef.sessionId);
            logger.info(`Session ${contextRef.sessionId} closed (${reason})`);
          }

          try {
            await contextRef.server.close();
            contextRef.sessionManager.deleteContext(contextRef.sessionId);
          } catch (closeError) {
            const err = closeError as Error;
            logger.error('Error closing MCP session', { error: err.message });
          }
        };

        transport.onclose = () => {
          if (!closeSession) {
            logger.warn('Transport closed before session was fully initialized');
            return;
          }
          closeSession('transport closed').catch((closeError: Error) => {
            logger.error('Failed to close MCP session', { error: closeError.message });
          });
        };

        sessionContext = contextRef;

        await sessionContext.server.connect(transport);
      }

      await sessionContext.transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Error handling middleware
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Express error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  });

  // Start server
  app.listen(PORT, () => {
    logger.info(`${APP_INFO.name} v${APP_INFO.version} running on port ${PORT}`);
    logger.info('Available endpoints:');
    logger.info(`  Health: http://localhost:${PORT}/health`);
    logger.info(`  MCP: http://localhost:${PORT}/mcp`);
  });
}

async function startStdioServer() {
  // In stdio mode, only log errors to stderr to avoid interfering with JSON-RPC
  const stdioLogger = winston.createLogger({
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        stderrLevels: ['error'],
        format: winston.format.simple()
      })
    ]
  });
  
  // Get credentials from environment variables
  const lmAccount = process.env.LM_ACCOUNT;
  const lmBearerToken = process.env.LM_BEARER_TOKEN;
  
  if (!lmAccount || !lmBearerToken) {
    stdioLogger.error('Missing required environment variables: LM_ACCOUNT and/or LM_BEARER_TOKEN');
    process.exit(1);
  }
  
  const server = await createServer({ 
    logger: stdioLogger,
    credentials: {
      lm_account: lmAccount,
      lm_bearer_token: lmBearerToken
    }
  });
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
}

// Main entry point
async function main() {
  try {
    // Check if running with stdio transport (for local testing)
    if (process.argv.includes('--stdio')) {
      await startStdioServer();
    } else {
      await startHttpServer();
    }
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, _promise) => {
  logger.error('Unhandled Rejection, reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
main();
