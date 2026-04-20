#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import express from 'express';
import winston from 'winston';
import { createServer } from './server.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID, createHash } from 'crypto';
import { APP_INFO } from './appInfo.js';
import { SessionManager } from './session/sessionManager.js';
import { getConfig } from './config/index.js';
import { AuthManager } from './auth/index.js';
import { createAuthMiddleware } from './auth/middleware.js';
import {
  type LMCredentials,
  resolveDefaultLogicMonitorCredentials,
  serializeCredentialsIdentity,
} from './auth/lmCredentials.js';
import { createRequestIdMiddleware } from './middleware/requestId.js';
import { createRateLimitMiddleware } from './middleware/rateLimit.js';
import { AuditLogger } from './audit/logger.js';
import { GracefulShutdown } from './utils/gracefulShutdown.js';

// Detect stdio mode early — before any logging can pollute stdout.
// In stdio mode, stdout is reserved exclusively for JSON-RPC messages.
const isStdioMode = process.argv.includes('--stdio');

// Load configuration
const config = getConfig();

// In stdio mode, ALL Winston transports must write to stderr so stdout
// remains clean for the JSON-RPC protocol used by StdioServerTransport.
function createStderrConsoleTransport(format: winston.Logform.Format): winston.transports.ConsoleTransportInstance {
  return new winston.transports.Console({
    format,
    stderrLevels: isStdioMode ? ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] : [],
  });
}

const logFormat = config.logging.format === 'simple'
  ? winston.format.combine(winston.format.colorize(), winston.format.simple())
  : winston.format.json();

// Set up logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [createStderrConsoleTransport(logFormat)]
});

// Initialize audit logger (routes to stderr in stdio mode)
const auditLogger = new AuditLogger(config, isStdioMode);

// Initialize graceful shutdown
const gracefulShutdown = new GracefulShutdown(logger);
gracefulShutdown.setupSignalHandlers();

async function startHttpServer() {
  const app = express();

  // Initialize auth manager
  const authManager = new AuthManager(config);

  // Request ID middleware
  app.use(createRequestIdMiddleware());
  
  // Parse JSON bodies
  app.use(express.json());

  // Authentication middleware
  app.use(createAuthMiddleware(authManager));

  // Rate limiting middleware (optional, disabled by default for trusted MCP clients)
  app.use(createRateLimitMiddleware(config));
  
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
    server: McpServer;
    clientId: string;
    credentialsKey: string;
    sessionId?: string;
    closed: boolean;
    sessionManager: SessionManager;
    lastActivityAt: number;
    cleanup?: () => void;
  };

  const MAX_SESSIONS = 100;
  const SESSION_TTL_MS = config.security.sessionTimeoutMs; // Configurable via SESSION_TIMEOUT_MS env var (default 1 hour)
  const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Sweep every 5 minutes

  const sessions = new Map<string, HttpSessionContext>();

  // Periodic cleanup of idle/orphaned sessions
  const sessionCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [sid, ctx] of sessions) {
      if (ctx.closed || (now - ctx.lastActivityAt > SESSION_TTL_MS)) {
        logger.info(`Evicting idle session: ${sid}`);
        ctx.closed = true;
        sessions.delete(sid);
        ctx.cleanup?.();
        ctx.sessionManager.deleteContext(sid);
        ctx.server.close().catch((err: Error) => {
          logger.error(`Error closing evicted session ${sid}`, { error: err.message });
        });
      }
    }
  }, SESSION_CLEANUP_INTERVAL_MS);
  sessionCleanupTimer.unref(); // Don't prevent process exit
  const buildCredentialsKey = (creds: LMCredentials) =>
    createHash('sha256').update(serializeCredentialsIdentity(creds)).digest('hex');

  // Handle all MCP requests at /mcp endpoint
  app.all('/mcp', async (req, res): Promise<void> => {
    try {
      // Auth context is set by auth middleware
      if (!req.auth) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { clientId, credentials } = req.auth;
      const credentialsKey = buildCredentialsKey(credentials);
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      let sessionContext: HttpSessionContext | undefined;

      // Try to reuse existing session
      if (sessionId) {
        sessionContext = sessions.get(sessionId);
        if (sessionContext?.closed) {
          sessions.delete(sessionId);
          sessionContext.sessionManager.deleteContext(sessionId);
          sessionContext = undefined;
        }
        // Verify client ID and credentials match
        if (sessionContext) {
          if (sessionContext.clientId !== clientId) {
            auditLogger.logAuthFailure(
              req.auth.authMode,
              'Client ID mismatch for existing session',
              req.ip,
              req.requestId
            );
            res.status(403).json({ error: 'Client ID mismatch for existing MCP session.' });
            return;
          }

          if (sessionContext.credentialsKey !== credentialsKey) {
            auditLogger.logAuthFailure(
              req.auth.authMode,
              'Credential mismatch for existing session',
              req.ip,
              req.requestId
            );
            res.status(403).json({ error: 'Credential mismatch for existing MCP session.' });
            return;
          }

          // Touch activity timestamp for session TTL tracking
          sessionContext.lastActivityAt = Date.now();
        }
      }

      // Create new session if needed
      if (!sessionContext) {
        // Enforce max session limit
        if (sessions.size >= MAX_SESSIONS) {
          logger.warn(`Max sessions (${MAX_SESSIONS}) reached, rejecting new connection`);
          res.status(503).json({ error: 'Server session limit reached. Please try again later.' });
          return;
        }
        // Use a deferred container so callbacks can safely reference the context
        // even though it's assigned after transport construction.
        const deferred: {
          ctx?: HttpSessionContext;
          close?: (reason: string) => Promise<void>;
        } = {};

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            if (!deferred.ctx) {
              logger.warn('onsessioninitialized fired before context was ready');
              return;
            }
            deferred.ctx.sessionId = newSessionId;
            sessions.set(newSessionId, deferred.ctx);
            logger.info(`Session initialized: ${newSessionId} for client: ${clientId}`);
            const authMode = req.auth?.authMode || 'none';
            auditLogger.logSessionCreated(newSessionId, clientId, authMode, req.requestId);
          },
          onsessionclosed: async (closedSessionId) => {
            try {
              if (deferred.close) {
                await deferred.close(`session closed request (${closedSessionId})`);
              }
            } catch (err) {
              logger.error('Error in onsessionclosed', { error: (err as Error).message });
            }
          }
        });

        const { server: mcpServer, sessionManager: serverSessionManager, cleanup } = await createServer({
          logger,
          credentials,
          clientId,
          authMode: req.auth.authMode,
          apiTimeoutMs: config.logicMonitor.apiTimeoutMs,
        });

        const contextRef: HttpSessionContext = {
          transport,
          server: mcpServer,
          clientId,
          credentialsKey,
          closed: false,
          sessionManager: serverSessionManager,
          lastActivityAt: Date.now(),
          cleanup,
        };

        deferred.ctx = contextRef;

        deferred.close = async (reason: string) => {
          if (contextRef.closed) {
            return;
          }
          contextRef.closed = true;

          if (contextRef.sessionId) {
            sessions.delete(contextRef.sessionId);
            logger.info(`Session ${contextRef.sessionId} closed (${reason})`);
            const authMode = req.auth?.authMode || 'none';
            auditLogger.logSessionClosed(
              contextRef.sessionId,
              clientId,
              authMode,
              reason,
              req.requestId
            );
          }

          try {
            await contextRef.server.close();
            contextRef.cleanup?.();
            if (contextRef.sessionId) {
              contextRef.sessionManager.deleteContext(contextRef.sessionId);
            }
          } catch (closeError) {
            const err = closeError as Error;
            logger.error('Error closing MCP session', { error: err.message });
          }
        };

        transport.onclose = () => {
          if (!deferred.close) {
            logger.warn('Transport closed before session was fully initialized');
            return;
          }
          deferred.close('transport closed').catch((closeError: Error) => {
            logger.error('Failed to close MCP session', { error: closeError.message });
          });
        };

        sessionContext = contextRef;

        await sessionContext.server.connect(transport);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    clearInterval(sessionCleanupTimer);
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
      // Config validation ensures certPath and keyPath exist when HTTPS is enabled
      const httpsOptions = {
        cert: fs.readFileSync(config.https.certPath as string),
        key: fs.readFileSync(config.https.keyPath as string),
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
  // In stdio mode, ALL log output must go to stderr — stdout is reserved
  // exclusively for JSON-RPC messages by the StdioServerTransport.
  const stdioLogger = winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
        format: winston.format.simple()
      })
    ]
  });
  
  const defaultCredentials = resolveDefaultLogicMonitorCredentials(config.logicMonitor);

  if (!defaultCredentials) {
    stdioLogger.error(
      'STDIO mode requires LM_ACCOUNT/LM_BEARER_TOKEN or LM_SESSION_LISTENER_BASE_URL (optionally with LM_PORTAL)'
    );
    throw new Error('Missing required LogicMonitor credentials for STDIO mode');
  }

  const credentialSummary = defaultCredentials.kind === 'bearer'
    ? `account: ${defaultCredentials.lm_account}`
    : defaultCredentials.kind === 'session'
      ? `portal: ${defaultCredentials.lm_portal}`
      : defaultCredentials.lm_default_portal
        ? `listener: ${defaultCredentials.lm_session_listener_base_url} (default portal: ${defaultCredentials.lm_default_portal})`
        : `listener: ${defaultCredentials.lm_session_listener_base_url}`;

  stdioLogger.info(`Starting STDIO mode with ${credentialSummary}`);
  
  const { server } = await createServer({ 
    logger: stdioLogger,
    credentials: defaultCredentials,
    clientId: 'stdio-client',
    authMode: 'none',
    apiTimeoutMs: config.logicMonitor.apiTimeoutMs,
  });
  
  const transport = new StdioServerTransport();
  
  gracefulShutdown.registerHandler(async () => {
    stdioLogger.info('Closing STDIO server...');
    await server.close();
  });
  
  await server.connect(transport);
  
  stdioLogger.info('STDIO server connected and ready');
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

    const shouldUseStdio = isStdioMode || !config.transport.enableHttp;
    
    if (shouldUseStdio && config.transport.enableStdio) {
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
