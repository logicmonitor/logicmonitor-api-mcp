import {
  DEFAULT_SESSION_LISTENER_BASE_URL,
  createListenerCredentials,
  createSessionCredentials,
  getLmCredentialsFromHeaders,
  serializeCredentialsIdentity,
} from '../../../src/auth/lmCredentials.js';

describe('lmCredentials helpers', () => {
  it('parses bearer credentials from headers', () => {
    const result = getLmCredentialsFromHeaders({
      'x-lm-account': 'acme',
      'x-lm-bearer-token': 'secret',
    });

    expect(result.error).toBeUndefined();
    expect(result.credentials).toEqual({
      kind: 'bearer',
      lm_account: 'acme',
      lm_bearer_token: 'secret',
    });
  });

  it('parses listener credentials from headers and defaults the listener base URL', () => {
    const result = getLmCredentialsFromHeaders({
      'x-lm-portal': 'Acme-Portal',
    });

    expect(result.error).toBeUndefined();
    expect(result.credentials).toEqual({
      kind: 'listener',
      lm_default_portal: 'acme-portal',
      lm_session_listener_base_url: DEFAULT_SESSION_LISTENER_BASE_URL,
    });
  });

  it('parses listener credentials from base-url-only headers', () => {
    const result = getLmCredentialsFromHeaders({
      'x-lm-session-listener-base-url': 'http://127.0.0.1:8072/',
    });

    expect(result.error).toBeUndefined();
    expect(result.credentials).toEqual({
      kind: 'listener',
      lm_default_portal: undefined,
      lm_session_listener_base_url: 'http://127.0.0.1:8072',
    });
  });

  it('rejects mixed bearer and session headers', () => {
    const result = getLmCredentialsFromHeaders({
      'x-lm-account': 'acme',
      'x-lm-bearer-token': 'secret',
      'x-lm-portal': 'prod',
    });

    expect(result.credentials).toBeUndefined();
    expect(result.error).toContain('Use either');
  });

  it('builds a stable identity string for session credentials', () => {
    const credentials = createSessionCredentials('Prod', 'http://127.0.0.1:8072/');
    expect(serializeCredentialsIdentity(credentials)).toBe(
      'session:prod:http://127.0.0.1:8072'
    );
  });

  it('distinguishes listener identities across default portals and base URLs', () => {
    expect(
      serializeCredentialsIdentity(createListenerCredentials('prod', 'http://127.0.0.1:8072/'))
    ).toBe('listener:prod:http://127.0.0.1:8072');

    expect(
      serializeCredentialsIdentity(createListenerCredentials(undefined, 'http://127.0.0.1:8073/'))
    ).toBe('listener::http://127.0.0.1:8073');
  });
});
