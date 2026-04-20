/**
 * Unit tests for BearerAuthValidator
 * Pure unit tests — no network access or LM credentials required.
 */

import { createHash } from 'crypto';
import { BearerAuthValidator } from '../../../src/auth/bearer.js';
import { CredentialMapper } from '../../../src/auth/credentialMapper.js';
import type { Config } from '../../../src/config/schema.js';

/** Helper: build a minimal Config object for CredentialMapper */
function makeConfig(overrides?: Partial<Config>): Config {
  return {
    server: { port: 3000, host: '0.0.0.0', nodeEnv: 'test' },
    transport: { enableStdio: false, enableHttp: true },
    https: { enabled: false, port: 3443 },
    auth: { mode: 'none' as const },
    logicMonitor: { apiTimeoutMs: 10000 },
    security: {
      rateLimitEnabled: false,
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 100,
      sessionTimeoutMs: 3600000,
    },
    logging: { level: 'info', format: 'json' as const, auditLogEnabled: false },
    ...overrides,
  } as Config;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('BearerAuthValidator', () => {
  const TOKEN_A = 'test-token-alpha';
  const TOKEN_B = 'test-token-beta';

  let mapper: CredentialMapper;
  let validator: BearerAuthValidator;

  beforeEach(() => {
    mapper = new CredentialMapper(makeConfig());
    validator = new BearerAuthValidator([TOKEN_A, TOKEN_B], mapper);
  });

  // ── constructor ──────────────────────────────────────────────────

  it('accepts an array of tokens and hashes them (constructor does not throw)', () => {
    // If we get here without an exception the constructor succeeded
    expect(validator).toBeDefined();
  });

  // ── validate() — happy path ──────────────────────────────────────

  it('returns success with clientId for a valid token', async () => {
    const result = await validator.validate(TOKEN_A);
    expect(result.success).toBe(true);
    expect(result.clientId).toBe(sha256(TOKEN_A));
    expect(result.error).toBeUndefined();
  });

  it('accepts every token that was registered', async () => {
    const resultA = await validator.validate(TOKEN_A);
    const resultB = await validator.validate(TOKEN_B);

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    expect(resultA.clientId).toBe(sha256(TOKEN_A));
    expect(resultB.clientId).toBe(sha256(TOKEN_B));
  });

  // ── validate() — rejection ──────────────────────────────────────

  it('rejects an invalid token', async () => {
    const result = await validator.validate('wrong-token');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid bearer token');
    expect(result.clientId).toBeUndefined();
  });

  it('rejects an empty string', async () => {
    const result = await validator.validate('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid bearer token');
  });

  // ── hashing determinism ─────────────────────────────────────────

  it('produces the same hash for the same token (deterministic)', async () => {
    const r1 = await validator.validate(TOKEN_A);
    const r2 = await validator.validate(TOKEN_A);
    expect(r1.clientId).toBe(r2.clientId);
  });

  // ── credential mapping integration ──────────────────────────────

  it('returns mapped credentials when credential mapping matches', async () => {
    const config = makeConfig({
      auth: {
        mode: 'bearer' as const,
        bearerTokens: [TOKEN_A],
        credentialMapping: {
          [TOKEN_A]: { account: 'acme', token: 'lm-bearer-xyz' },
        },
      },
    });
    const mapperWithCreds = new CredentialMapper(config);
    const v = new BearerAuthValidator([TOKEN_A], mapperWithCreds);

    const result = await v.validate(TOKEN_A);
    expect(result.success).toBe(true);
    expect(result.credentials).toEqual({
      kind: 'bearer',
      lm_account: 'acme',
      lm_bearer_token: 'lm-bearer-xyz',
    });
  });

  it('returns undefined credentials when no mapping exists', async () => {
    const result = await validator.validate(TOKEN_A);
    expect(result.success).toBe(true);
    expect(result.credentials).toBeUndefined();
  });
});
