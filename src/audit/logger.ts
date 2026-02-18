/**
 * Audit logging system
 * Structured logging for security and compliance
 */

import winston from 'winston';
import type { Config } from '../config/schema.js';
import type { AuditEvent } from './events.js';

export class AuditLogger {
  private logger: winston.Logger;
  private enabled: boolean;

  constructor(config: Config) {
    this.enabled = config.logging.auditLogEnabled;

    // Create dedicated audit logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'logicmonitor-mcp',
        audit: true,
      },
      transports: [
        new winston.transports.Console({
          format: config.logging.format === 'simple'
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
              )
            : winston.format.json(),
        }),
      ],
    });
  }

  /**
   * Log an audit event
   */
  log(event: AuditEvent): void {
    if (!this.enabled) {
      return;
    }

    this.logger.info('audit_event', event);
  }

  /**
   * Log authentication success
   */
  logAuthSuccess(clientId: string, authMode: 'none' | 'bearer', ipAddress?: string, requestId?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      event: 'auth_success',
      clientId,
      authMode,
      ipAddress,
      requestId,
    });
  }

  /**
   * Log authentication failure
   */
  logAuthFailure(authMode: 'none' | 'bearer', error: string, ipAddress?: string, requestId?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      event: 'auth_failure',
      authMode,
      error,
      ipAddress,
      requestId,
    });
  }

  /**
   * Log session creation
   */
  logSessionCreated(sessionId: string, clientId: string, authMode: 'none' | 'bearer', requestId?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      event: 'session_created',
      sessionId,
      clientId,
      authMode,
      requestId,
    });
  }

  /**
   * Log session closure
   */
  logSessionClosed(sessionId: string, clientId: string, authMode: 'none' | 'bearer', reason?: string, requestId?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      event: 'session_closed',
      sessionId,
      clientId,
      authMode,
      reason,
      requestId,
    });
  }

  /**
   * Log tool call
   */
  logToolCall(
    clientId: string,
    authMode: 'none' | 'bearer',
    tool: string,
    operation: string | undefined,
    success: boolean,
    durationMs?: number,
    sessionId?: string,
    error?: string,
    requestId?: string
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      event: success ? 'tool_call' : 'tool_error',
      sessionId,
      clientId,
      authMode,
      tool,
      operation,
      success,
      durationMs,
      error,
      requestId,
    });
  }

  /**
   * Log server event
   */
  logServerEvent(event: 'config_loaded' | 'server_started' | 'server_stopped', details?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      event,
      details,
    });
  }
}

