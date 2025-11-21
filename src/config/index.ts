/**
 * Configuration loader and validator
 * Loads configuration from environment variables with validation
 */

import dotenv from 'dotenv';
import { ValidatedConfigSchema, type Config, type CredentialMapping } from './schema.js';
import { CONFIG_DEFAULTS } from './defaults.js';
import { z } from 'zod';

// Load .env file if it exists
dotenv.config({ quiet: true });

/**
 * Parse comma-separated string into array
 */
function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Parse JSON string safely
 */
function parseJSON<T>(value: string | undefined, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse boolean from string
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse integer from string
 */
function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }
  return parsed;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const rawConfig = {
    server: {
      port: parseInt(process.env.PORT, CONFIG_DEFAULTS.port),
      host: process.env.HOST || CONFIG_DEFAULTS.host,
      nodeEnv: process.env.NODE_ENV || CONFIG_DEFAULTS.nodeEnv,
    },

    transport: {
      enableStdio: parseBoolean(process.env.ENABLE_STDIO, CONFIG_DEFAULTS.enableStdio),
      enableHttp: parseBoolean(process.env.ENABLE_HTTP, CONFIG_DEFAULTS.enableHttp),
    },

    https: {
      enabled: parseBoolean(process.env.HTTPS_ENABLED, CONFIG_DEFAULTS.httpsEnabled),
      port: parseInt(process.env.HTTPS_PORT, CONFIG_DEFAULTS.httpsPort),
      certPath: process.env.HTTPS_CERT_PATH,
      keyPath: process.env.HTTPS_KEY_PATH,
      caPath: process.env.HTTPS_CA_PATH,
    },

    auth: {
      mode: (process.env.AUTH_MODE || CONFIG_DEFAULTS.authMode) as 'none' | 'bearer',
      bearerTokens: parseCommaSeparated(process.env.MCP_BEARER_TOKENS),
      credentialMapping: parseJSON<CredentialMapping>(
        process.env.AUTH_CREDENTIAL_MAPPING,
        {}
      ),
    },

    logicMonitor: {
      account: process.env.LM_ACCOUNT,
      bearerToken: process.env.LM_BEARER_TOKEN,
      apiTimeoutMs: parseInt(process.env.LM_API_TIMEOUT_MS, CONFIG_DEFAULTS.lmApiTimeoutMs),
    },

    security: {
      rateLimitEnabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, CONFIG_DEFAULTS.rateLimitEnabled),
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, CONFIG_DEFAULTS.rateLimitWindowMs),
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, CONFIG_DEFAULTS.rateLimitMaxRequests),
      sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS, CONFIG_DEFAULTS.sessionTimeoutMs),
    },

    logging: {
      level: process.env.LOG_LEVEL || CONFIG_DEFAULTS.logLevel,
      format: (process.env.LOG_FORMAT || CONFIG_DEFAULTS.logFormat) as 'json' | 'simple',
      auditLogEnabled: parseBoolean(process.env.AUDIT_LOG_ENABLED, CONFIG_DEFAULTS.auditLogEnabled),
    },
  };

  // Validate configuration
  try {
    const validated = ValidatedConfigSchema.parse(rawConfig);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err) => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      }).join('\n');
      
      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Validate configuration and log warnings
 */
export function validateAndWarn(config: Config): void {
  const warnings: string[] = [];

  // Warn if HTTP is enabled without authentication
  if (config.transport.enableHttp && config.auth.mode === 'none') {
    warnings.push(
      'WARNING: HTTP transport is enabled without authentication (AUTH_MODE=none). ' +
      'This is insecure for production deployments. ' +
      'Consider setting AUTH_MODE=bearer.'
    );
  }

  // Warn if HTTPS is not enabled in production
  if (
    config.server.nodeEnv === 'production' &&
    config.transport.enableHttp &&
    !config.https.enabled
  ) {
    warnings.push(
      'WARNING: Running in production mode without HTTPS. ' +
      'Set HTTPS_ENABLED=true for secure deployments.'
    );
  }

  // Warn if no transports are enabled
  if (!config.transport.enableStdio && !config.transport.enableHttp) {
    throw new Error('At least one transport (STDIO or HTTP) must be enabled');
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('\n' + warnings.join('\n\n') + '\n');
  }
}

/**
 * Get the singleton config instance
 */
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
    validateAndWarn(configInstance);
  }
  return configInstance;
}

/**
 * Reset config instance (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}
