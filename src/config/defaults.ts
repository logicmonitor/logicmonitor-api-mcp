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

  // Rate limiting is disabled by default for MCP servers since clients are typically trusted
  // Enable for public deployments or when serving untrusted clients
  rateLimitEnabled: false,
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 100,
  sessionTimeoutMs: 3600000,

  // Logging
  logLevel: 'info',
  logFormat: 'json' as const,
  auditLogEnabled: true,
} as const;

export type AuthMode = 'none' | 'bearer';
export type LogFormat = 'json' | 'simple';

