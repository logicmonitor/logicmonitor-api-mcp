/**
 * Configuration schema and types using Zod
 */

import { z } from 'zod';
import { CONFIG_DEFAULTS } from './defaults.js';

// Auth mode enum
export const AuthModeSchema = z.enum(['none', 'bearer']);
export type AuthMode = z.infer<typeof AuthModeSchema>;

// Log format enum
export const LogFormatSchema = z.enum(['json', 'simple']);
export type LogFormat = z.infer<typeof LogFormatSchema>;

// Credential mapping schema
export const CredentialMappingSchema = z.record(
  z.string(),
  z.object({
    account: z.string(),
    token: z.string(),
  })
);
export type CredentialMapping = z.infer<typeof CredentialMappingSchema>;

// Main configuration schema
export const ConfigSchema = z.object({
  // Server
  server: z.object({
    port: z.number().int().min(1).max(65535).default(CONFIG_DEFAULTS.port),
    host: z.string().default(CONFIG_DEFAULTS.host),
    nodeEnv: z.string().default(CONFIG_DEFAULTS.nodeEnv),
  }),

  // Transport
  transport: z.object({
    enableStdio: z.boolean().default(CONFIG_DEFAULTS.enableStdio),
    enableHttp: z.boolean().default(CONFIG_DEFAULTS.enableHttp),
  }),

  // HTTPS
  https: z.object({
    enabled: z.boolean().default(CONFIG_DEFAULTS.httpsEnabled),
    port: z.number().int().min(1).max(65535).default(CONFIG_DEFAULTS.httpsPort),
    certPath: z.string().optional(),
    keyPath: z.string().optional(),
    caPath: z.string().optional(),
  }).refine(
    (data) => {
      // If HTTPS is enabled, cert and key paths are required
      if (data.enabled) {
        return data.certPath && data.keyPath;
      }
      return true;
    },
    {
      message: 'HTTPS_CERT_PATH and HTTPS_KEY_PATH are required when HTTPS_ENABLED=true',
    }
  ),

  // Authentication
  auth: z.object({
    mode: AuthModeSchema.default(CONFIG_DEFAULTS.authMode),
    
    // Bearer token auth
    bearerTokens: z.array(z.string()).optional(),
    
    // Credential mapping (auth identity -> LM credentials)
    credentialMapping: CredentialMappingSchema.optional(),
  }).refine(
    (data) => {
      // If auth mode is bearer, tokens are required
      if (data.mode === 'bearer') {
        return data.bearerTokens && data.bearerTokens.length > 0;
      }
      return true;
    },
    {
      message: 'MCP_BEARER_TOKENS is required when AUTH_MODE=bearer',
    }
  ),

  // LogicMonitor
  logicMonitor: z.object({
    account: z.string().optional(),
    bearerToken: z.string().optional(),
    apiTimeoutMs: z.number().int().min(1000).default(CONFIG_DEFAULTS.lmApiTimeoutMs),
  }),

  // Security
  security: z.object({
    rateLimitEnabled: z.boolean().default(CONFIG_DEFAULTS.rateLimitEnabled),
    rateLimitWindowMs: z.number().int().min(1000).default(CONFIG_DEFAULTS.rateLimitWindowMs),
    rateLimitMaxRequests: z.number().int().min(1).default(CONFIG_DEFAULTS.rateLimitMaxRequests),
    sessionTimeoutMs: z.number().int().min(60000).default(CONFIG_DEFAULTS.sessionTimeoutMs),
  }),

  // Logging
  logging: z.object({
    level: z.string().default(CONFIG_DEFAULTS.logLevel),
    format: LogFormatSchema.default(CONFIG_DEFAULTS.logFormat),
    auditLogEnabled: z.boolean().default(CONFIG_DEFAULTS.auditLogEnabled),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// Validation refinements for the entire config
export const ValidatedConfigSchema = ConfigSchema.refine(
  (data) => {
    // If HTTP is enabled without auth, log a warning (not an error for backward compatibility)
    if (data.transport.enableHttp && data.auth.mode === 'none') {
      // This will be logged as a warning in the config loader
      return true;
    }
    return true;
  }
);
