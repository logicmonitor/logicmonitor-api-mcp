/**
 * Default configuration values
 */

export const CONFIG_DEFAULTS = {
  // Server
  port: 3001,
  host: '0.0.0.0',
  nodeEnv: 'development',

  // Transport
  enableStdio: true,
  enableHttp: true,

  // HTTPS
  httpsEnabled: false,
  httpsPort: 3443,

  // Authentication
  authMode: 'none' as const,

  // LogicMonitor
  lmApiTimeoutMs: 30000,

  // Security
  corsEnabled: true,
  corsOrigins: ['http://localhost:3000'],
  rateLimitEnabled: true,
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 100,
  sessionTimeoutMs: 3600000,

  // Logging
  logLevel: 'info',
  logFormat: 'json' as const,
  auditLogEnabled: true,
} as const;

export type AuthMode = 'none' | 'bearer' | 'oauth';
export type LogFormat = 'json' | 'simple';

