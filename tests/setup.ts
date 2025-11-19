/**
 * Jest setup file
 * Runs before all tests
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ quiet: true });

// Verify required environment variables
const requiredEnvVars = ['LM_ACCOUNT', 'LM_BEARER_TOKEN'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(
    `⚠️  Warning: Missing environment variables: ${missingVars.join(', ')}\n` +
    `   Tests requiring LogicMonitor API access will fail.\n` +
    `   Set these in your .env file or environment.`
  );
}

// Global test configuration
(global as any).testConfig = {
  lmAccount: process.env.LM_ACCOUNT || '',
  lmBearerToken: process.env.LM_BEARER_TOKEN || '',
  testResourcePrefix: 'mcp-test',
  cleanupOnFailure: process.env.CLEANUP_ON_FAILURE !== 'false',
};

