/**
 * Unit tests for CredentialMapper
 * Pure unit tests — no network access or LM credentials required.
 */

import { CredentialMapper } from '../../../src/auth/credentialMapper.js';
import type { Config } from '../../../src/config/schema.js';

/** Helper: build a minimal Config object with optional overrides */
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

describe('CredentialMapper', () => {
  // ── exact match ──────────────────────────────────────────────────

  it('returns correct credentials for an exact-match key', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        auth: {
          mode: 'bearer' as const,
          credentialMapping: {
            'client-1': { account: 'acme', token: 'tok-1' },
            'client-2': { account: 'globex', token: 'tok-2' },
          },
        },
      }),
    );

    const creds = mapper.getCredentials('client-1');
    expect(creds).toEqual({
      kind: 'bearer',
      lm_account: 'acme',
      lm_bearer_token: 'tok-1'
    });
  });

  // ── wildcard fallback ────────────────────────────────────────────

  it('falls back to wildcard credentials when no exact match', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        auth: {
          mode: 'bearer' as const,
          credentialMapping: {
            '*': { account: 'wildcard-acct', token: 'wildcard-tok' },
          },
        },
      }),
    );

    const creds = mapper.getCredentials('unknown-client');
    expect(creds).toEqual({
      kind: 'bearer',
      lm_account: 'wildcard-acct',
      lm_bearer_token: 'wildcard-tok',
    });
  });

  // ── no match, no wildcard ────────────────────────────────────────

  it('returns undefined when there is no match and no wildcard', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        auth: {
          mode: 'bearer' as const,
          credentialMapping: {
            'client-1': { account: 'acme', token: 'tok-1' },
          },
        },
      }),
    );

    const creds = mapper.getCredentials('unknown-client');
    expect(creds).toBeUndefined();
  });

  // ── priority: exact > wildcard ───────────────────────────────────

  it('prefers exact match over wildcard', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        auth: {
          mode: 'bearer' as const,
          credentialMapping: {
            'client-1': { account: 'exact-acct', token: 'exact-tok' },
            '*': { account: 'wildcard-acct', token: 'wildcard-tok' },
          },
        },
      }),
    );

    const creds = mapper.getCredentials('client-1');
    expect(creds).toEqual({
      kind: 'bearer',
      lm_account: 'exact-acct',
      lm_bearer_token: 'exact-tok',
    });
  });

  // ── empty mapping ────────────────────────────────────────────────

  it('returns undefined when no credential mapping is configured', () => {
    const mapper = new CredentialMapper(makeConfig());
    const creds = mapper.getCredentials('any-client');
    expect(creds).toBeUndefined();
  });

  // ── default credentials fallback ─────────────────────────────────

  it('falls back to default credentials from logicMonitor config', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        logicMonitor: {
          account: 'default-acct',
          bearerToken: 'default-tok',
          apiTimeoutMs: 10000,
        },
      }),
    );

    const creds = mapper.getCredentials('unknown-client');
    expect(creds).toEqual({
      kind: 'bearer',
      lm_account: 'default-acct',
      lm_bearer_token: 'default-tok',
    });
  });

  it('supports session-based default credentials from logicMonitor config', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        logicMonitor: {
          portal: 'prod',
          sessionListenerBaseUrl: 'http://127.0.0.1:8072',
          apiTimeoutMs: 10000,
        },
      }),
    );

    expect(mapper.getDefaultCredentials()).toEqual({
      kind: 'listener',
      lm_default_portal: 'prod',
      lm_session_listener_base_url: 'http://127.0.0.1:8072',
    });
  });

  it('supports session-based credential mappings', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        auth: {
          mode: 'bearer' as const,
          credentialMapping: {
            'client-1': { portal: 'prod', listenerBaseUrl: 'http://127.0.0.1:8072' },
          },
        },
      }),
    );

    expect(mapper.getCredentials('client-1')).toEqual({
      kind: 'listener',
      lm_default_portal: 'prod',
      lm_session_listener_base_url: 'http://127.0.0.1:8072',
    });
  });

  it('keeps listener defaults distinct across mapped clients', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        auth: {
          mode: 'bearer' as const,
          credentialMapping: {
            'client-1': { portal: 'prod', listenerBaseUrl: 'http://127.0.0.1:8072' },
            'client-2': { portal: 'gov', listenerBaseUrl: 'http://127.0.0.1:8072' },
          },
        },
      }),
    );

    expect(mapper.getCredentials('client-1')).toEqual({
      kind: 'listener',
      lm_default_portal: 'prod',
      lm_session_listener_base_url: 'http://127.0.0.1:8072',
    });
    expect(mapper.getCredentials('client-2')).toEqual({
      kind: 'listener',
      lm_default_portal: 'gov',
      lm_session_listener_base_url: 'http://127.0.0.1:8072',
    });
  });

  // ── priority: exact > wildcard > default ─────────────────────────

  it('prefers wildcard over default credentials', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        auth: {
          mode: 'bearer' as const,
          credentialMapping: {
            '*': { account: 'wildcard-acct', token: 'wildcard-tok' },
          },
        },
        logicMonitor: {
          account: 'default-acct',
          bearerToken: 'default-tok',
          apiTimeoutMs: 10000,
        },
      }),
    );

    const creds = mapper.getCredentials('unknown-client');
    expect(creds).toEqual({
      kind: 'bearer',
      lm_account: 'wildcard-acct',
      lm_bearer_token: 'wildcard-tok',
    });
  });

  // ── hasCredentials helper ────────────────────────────────────────

  it('hasCredentials returns true when credentials exist', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        auth: {
          mode: 'bearer' as const,
          credentialMapping: {
            'client-1': { account: 'acme', token: 'tok-1' },
          },
        },
      }),
    );

    expect(mapper.hasCredentials('client-1')).toBe(true);
  });

  it('hasCredentials returns false when no credentials exist', () => {
    const mapper = new CredentialMapper(makeConfig());
    expect(mapper.hasCredentials('unknown')).toBe(false);
  });

  // ── getDefaultCredentials ────────────────────────────────────────

  it('getDefaultCredentials returns default credentials from config', () => {
    const mapper = new CredentialMapper(
      makeConfig({
        logicMonitor: {
          account: 'default-acct',
          bearerToken: 'default-tok',
          apiTimeoutMs: 10000,
        },
      }),
    );

    expect(mapper.getDefaultCredentials()).toEqual({
      kind: 'bearer',
      lm_account: 'default-acct',
      lm_bearer_token: 'default-tok',
    });
  });

  it('getDefaultCredentials returns undefined when no defaults configured', () => {
    const mapper = new CredentialMapper(makeConfig());
    expect(mapper.getDefaultCredentials()).toBeUndefined();
  });
});
