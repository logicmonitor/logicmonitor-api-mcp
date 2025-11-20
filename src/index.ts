#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import winston from 'winston';
import { createServer } from './server.js';
import { StdioServerTransport } from '@socotra/modelcontextprotocol-sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@socotra/modelcontextprotocol-sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import { APP_INFO } from './appInfo.js';
import { SessionManager } from './session/sessionManager.js';
import { getConfig } from './config/index.js';
import { AuthManager } from './auth/index.js';
import { createAuthMiddleware } from './auth/middleware.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { createRequestIdMiddleware } from './middleware/requestId.js';
import { createRateLimitMiddleware } from './middleware/rateLimit.js';
import { AuditLogger } from './audit/logger.js';
import { GracefulShutdown } from './utils/gracefulShutdown.js';

// Load configuration
const config = getConfig();

// Set up logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: config.logging.format === 'simple'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : winston.format.json()
    })
  ]
});

// Initialize audit logger
const auditLogger = new AuditLogger(config);

// Initialize graceful shutdown
const gracefulShutdown = new GracefulShutdown(logger);
gracefulShutdown.setupSignalHandlers();

async function startHttpServer() {
  const app = express();

  // Initialize auth manager
  const authManager = new AuthManager(config);

  // Security middleware
  app.use(helmet());
  
  // CORS middleware
  app.use(createCorsMiddleware(config));
  
  // Request ID middleware
  app.use(createRequestIdMiddleware());
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Rate limiting middleware (applied before auth)
  app.use(createRateLimitMiddleware(config));
  
  // Authentication middleware
  app.use(createAuthMiddleware(authManager));
  
  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ 
      status: 'ok', 
      service: APP_INFO.name, 
      version: APP_INFO.version,
      authMode: authManager.getAuthMode(),
    });
  });

  type HttpSessionContext = {
    transport: StreamableHTTPServerTransport;
    server: Awaited<ReturnType<typeof createServer>>;
    clientId: string;
    sessionId?: string;
    closed: boolean;
    sessionManager: SessionManager;
  };

  const sessions = new Map<string, HttpSessionContext>();

  // Handle all MCP requests at /mcp endpoint
  app.all('/mcp', async (req, res): Promise<void> => {
    try {
      // Auth context is set by auth middleware
      if (!req.auth) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { clientId, credentials } = req.auth;
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      let sessionContext: HttpSessionContext | undefined;

      // Try to reuse existing session
      if (sessionId) {
        sessionContext = sessions.get(sessionId);
        if (sessionContext?.closed) {
          sessions.delete(sessionId);
          sessionContext = undefined;
        }
        // Verify client ID matches
        if (sessionContext && sessionContext.clientId !== clientId) {
          auditLogger.logAuthFailure(
            req.auth.authMode,
            'Client ID mismatch for existing session',
            req.ip,
            req.requestId
          );
          res.status(403).json({ error: 'Client ID mismatch for existing MCP session.' });
          return;
        }
      }

      // Create new session if needed
      if (!sessionContext) {
        let contextRef: HttpSessionContext;
        let closeSession: (reason: string) => Promise<void>;

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            contextRef.sessionId = newSessionId;
            sessions.set(newSessionId, contextRef);
            logger.info(`Session initialized: ${newSessionId} for client: ${clientId}`);
            auditLogger.logSessionCreated(newSessionId, clientId, req.auth!.authMode, req.requestId);
          },
          onsessionclosed: async (closedSessionId) => {
            await closeSession(`session closed request (${closedSessionId})`);
          }
        });

        const mcpServer = await createServer({
          logger,
          credentials,
          clientId,
          authMode: req.auth.authMode,
        });

        const sessionManager =
          ((mcpServer as unknown) as { sessionManager?: SessionManager }).sessionManager ??
          new SessionManager();

        contextRef = {
          transport,
          server: mcpServer,
          clientId,
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
            auditLogger.logSessionClosed(
              contextRef.sessionId,
              clientId,
              req.auth!.authMode,
              reason,
              req.requestId
            );
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

      await sessionContext.transport.handleRequest(req as any, res, req.body);
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

  // Register session cleanup on shutdown
  gracefulShutdown.registerHandler(async () => {
    logger.info('Closing all MCP sessions...');
    const closePromises = Array.from(sessions.values()).map(async (session) => {
      if (!session.closed && session.sessionId) {
        try {
          await session.server.close();
          session.sessionManager.deleteContext(session.sessionId);
          session.closed = true;
        } catch (error) {
          logger.error(`Error closing session ${session.sessionId}:`, error);
        }
      }
    });
    await Promise.all(closePromises);
    sessions.clear();
    logger.info('All MCP sessions closed');
  });

  // Start HTTP server
  const httpServer = app.listen(config.server.port, config.server.host, () => {
    logger.info(`${APP_INFO.name} v${APP_INFO.version} running on http://${config.server.host}:${config.server.port}`);
    logger.info('Available endpoints:');
    logger.info(`  Health: http://localhost:${config.server.port}/health`);
    logger.info(`  MCP: http://localhost:${config.server.port}/mcp`);
    logger.info(`Auth mode: ${authManager.getAuthMode()}`);
    auditLogger.logServerEvent('server_started', {
      port: config.server.port,
      authMode: authManager.getAuthMode(),
      httpsEnabled: false,
    });
  });

  gracefulShutdown.registerServer(httpServer, 'HTTP');

  // Start HTTPS server if enabled
  if (config.https.enabled) {
    try {
      const httpsOptions = {
        cert: fs.readFileSync(config.https.certPath!),
        key: fs.readFileSync(config.https.keyPath!),
        ca: config.https.caPath ? fs.readFileSync(config.https.caPath) : undefined,
      };

      const httpsServer = https.createServer(httpsOptions, app);
      
      httpsServer.listen(config.https.port, config.server.host, () => {
        logger.info(`HTTPS server running on https://${config.server.host}:${config.https.port}`);
        auditLogger.logServerEvent('server_started', {
          port: config.https.port,
          authMode: authManager.getAuthMode(),
          httpsEnabled: true,
        });
      });

      gracefulShutdown.registerServer(httpsServer, 'HTTPS');
    } catch (error) {
      logger.error('Failed to start HTTPS server:', error);
      throw error;
    }
  }
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
  
  // Validate credentials
  if (!config.logicMonitor.account || !config.logicMonitor.bearerToken) {
    stdioLogger.error('STDIO mode requires LM_ACCOUNT and LM_BEARER_TOKEN environment variables');
    throw new Error('Missing required LogicMonitor credentials for STDIO mode');
  }
  
  stdioLogger.error(`Starting STDIO mode with account: ${config.logicMonitor.account}`);
  
  const server = await createServer({ 
    logger: stdioLogger,
    credentials: {
      lm_account: config.logicMonitor.account,
      lm_bearer_token: config.logicMonitor.bearerToken
    },
    clientId: 'stdio-client',
    authMode: 'none',
  });
  
  const transport = new StdioServerTransport();
  
  // Register cleanup on shutdown
  gracefulShutdown.registerHandler(async () => {
    stdioLogger.error('Closing STDIO server...');
    await server.close();
  });
  
  await server.connect(transport);
  
  stdioLogger.error('STDIO server connected and ready');
}

// Main entry point
async function main() {
  try {
    auditLogger.logServerEvent('config_loaded', {
      authMode: config.auth.mode,
      transports: {
        stdio: config.transport.enableStdio,
        http: config.transport.enableHttp,
        https: config.https.enabled,
      },
    });

    // Determine which transports to start
    const isStdioMode = process.argv.includes('--stdio') || !config.transport.enableHttp;
    
    if (isStdioMode && config.transport.enableStdio) {
      logger.info('Starting in STDIO mode');
      await startStdioServer();
    } else if (config.transport.enableHttp) {
      logger.info('Starting in HTTP mode');
      await startHttpServer();
    } else {
      throw new Error('No transports enabled. Set ENABLE_STDIO=true or ENABLE_HTTP=true');
    }
  } catch (error) {
    logger.error('Failed to start server', error);
    await gracefulShutdown.shutdown('startup_error');
    process.exit(1);
  }
}

// Start the server
main();
