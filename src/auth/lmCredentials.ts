import type { IncomingHttpHeaders } from 'http';
import type { Config, CredentialMappingEntry } from '../config/schema.js';

export const DEFAULT_SESSION_LISTENER_BASE_URL = 'http://127.0.0.1:8072';

export interface BearerLMCredentials {
  kind: 'bearer';
  lm_account: string;
  lm_bearer_token: string;
}

export interface SessionLMCredentials {
  kind: 'session';
  lm_portal: string;
  lm_session_listener_base_url: string;
}

export interface ListenerLMCredentials {
  kind: 'listener';
  lm_default_portal?: string;
  lm_session_listener_base_url: string;
}

export type ResolvedLMCredentials = BearerLMCredentials | SessionLMCredentials;
export type LMCredentials = ResolvedLMCredentials | ListenerLMCredentials;

function extractHeader(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizePortal(portal: string): string {
  return portal.trim().toLowerCase();
}

export function normalizeListenerBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function createBearerCredentials(account: string, token: string): BearerLMCredentials {
  return {
    kind: 'bearer',
    lm_account: account.trim(),
    lm_bearer_token: token.trim(),
  };
}

export function createSessionCredentials(
  portal: string,
  listenerBaseUrl: string = DEFAULT_SESSION_LISTENER_BASE_URL
): SessionLMCredentials {
  return {
    kind: 'session',
    lm_portal: normalizePortal(portal),
    lm_session_listener_base_url: normalizeListenerBaseUrl(listenerBaseUrl),
  };
}

export function createListenerCredentials(
  defaultPortal?: string,
  listenerBaseUrl: string = DEFAULT_SESSION_LISTENER_BASE_URL
): ListenerLMCredentials {
  const normalizedDefaultPortal = defaultPortal && defaultPortal.trim()
    ? normalizePortal(defaultPortal)
    : undefined;

  return {
    kind: 'listener',
    lm_default_portal: normalizedDefaultPortal,
    lm_session_listener_base_url: normalizeListenerBaseUrl(listenerBaseUrl),
  };
}

export function resolveCredentialMappingEntry(value: CredentialMappingEntry): LMCredentials {
  if ('account' in value) {
    return createBearerCredentials(value.account, value.token);
  }

  return createListenerCredentials(value.portal, value.listenerBaseUrl);
}

export function resolveDefaultLogicMonitorCredentials(
  logicMonitor: Config['logicMonitor']
): LMCredentials | undefined {
  if (logicMonitor.account && logicMonitor.bearerToken) {
    return createBearerCredentials(logicMonitor.account, logicMonitor.bearerToken);
  }

  if (logicMonitor.portal || logicMonitor.sessionListenerBaseUrl) {
    return createListenerCredentials(logicMonitor.portal, logicMonitor.sessionListenerBaseUrl);
  }

  return undefined;
}

export function getLmCredentialsFromHeaders(
  headers: IncomingHttpHeaders
): { credentials?: LMCredentials; error?: string } {
  const account = extractHeader(headers['x-lm-account']);
  const token = extractHeader(headers['x-lm-bearer-token']);
  const portal = extractHeader(headers['x-lm-portal']);
  const listenerBaseUrl = extractHeader(headers['x-lm-session-listener-base-url']);

  const hasBearerHeaders = Boolean(account || token);
  const hasSessionHeaders = Boolean(portal || listenerBaseUrl);

  if (hasBearerHeaders && hasSessionHeaders) {
    return {
      error: 'Use either X-LM-Account/X-LM-Bearer-Token or X-LM-Portal/X-LM-Session-Listener-Base-Url headers, not both.'
    };
  }

  if ((account && !token) || (!account && token)) {
    return { error: 'Both X-LM-Account and X-LM-Bearer-Token headers are required together.' };
  }

  if (account && token) {
    return {
      credentials: createBearerCredentials(account, token)
    };
  }

  if (portal || listenerBaseUrl) {
    return {
      credentials: createListenerCredentials(portal, listenerBaseUrl)
    };
  }

  return {};
}

export function serializeCredentialsIdentity(credentials: LMCredentials): string {
  if (credentials.kind === 'bearer') {
    return `bearer:${credentials.lm_account.trim().toLowerCase()}:${credentials.lm_bearer_token}`;
  }

  if (credentials.kind === 'session') {
    return `session:${credentials.lm_portal}:${credentials.lm_session_listener_base_url}`;
  }

  return `listener:${credentials.lm_default_portal ?? ''}:${credentials.lm_session_listener_base_url}`;
}

export function isListenerCredentials(credentials: LMCredentials): credentials is ListenerLMCredentials {
  return credentials.kind === 'listener';
}

export function isSessionCredentials(credentials: LMCredentials): credentials is SessionLMCredentials {
  return credentials.kind === 'session';
}

export function isResolvedCredentials(credentials: LMCredentials): credentials is ResolvedLMCredentials {
  return credentials.kind !== 'listener';
}
