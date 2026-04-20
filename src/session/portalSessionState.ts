import { createHash } from 'crypto';
import { createSessionCredentials, normalizePortal, serializeCredentialsIdentity } from '../auth/lmCredentials.js';
import type { SessionManager } from './sessionManager.js';

const DEFAULT_SESSION_ID = 'default';
const DEFAULT_PORTAL_KEY = 'defaultPortal';
const PORTAL_SCOPES_KEY = '__portalScopes';

export interface PortalScopeRecord {
  portal: string;
  sessionId: string;
  credentialsIdentity: string;
  lastUsedAt: string;
}

type PortalScopeMap = Record<string, PortalScopeRecord>;

function getScopeMapFromContext(
  sessionManager: SessionManager,
  sessionId?: string
): { context: ReturnType<SessionManager['getContext']>; scopes: PortalScopeMap } {
  const context = sessionManager.getContext(getBaseSessionId(sessionId));
  const rawValue = context.variables[PORTAL_SCOPES_KEY];

  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return { context, scopes: {} };
  }

  return {
    context,
    scopes: rawValue as PortalScopeMap,
  };
}

export function getBaseSessionId(sessionId?: string): string {
  return sessionId ?? DEFAULT_SESSION_ID;
}

export function buildScopedSessionId(sessionId: string | undefined, credentialsIdentity: string): string {
  const baseSessionId = getBaseSessionId(sessionId);
  const suffix = createHash('sha256')
    .update(`${baseSessionId}:${credentialsIdentity}`)
    .digest('hex')
    .slice(0, 16);
  return `${baseSessionId}::lm::${suffix}`;
}

export function buildPortalScopedSessionId(
  sessionId: string | undefined,
  portal: string,
  listenerBaseUrl: string
): string {
  const identity = serializeCredentialsIdentity(
    createSessionCredentials(portal, listenerBaseUrl)
  );
  return buildScopedSessionId(sessionId, identity);
}

export function getDefaultPortal(sessionManager: SessionManager, sessionId?: string): string | undefined {
  const context = sessionManager.getContext(getBaseSessionId(sessionId));
  const value = context.variables[DEFAULT_PORTAL_KEY];
  return typeof value === 'string' && value.trim()
    ? normalizePortal(value)
    : undefined;
}

export function setDefaultPortal(
  sessionManager: SessionManager,
  sessionId: string | undefined,
  portal?: string | null
) {
  const context = sessionManager.getContext(getBaseSessionId(sessionId));

  if (!portal || !portal.trim()) {
    delete context.variables[DEFAULT_PORTAL_KEY];
    return context;
  }

  context.variables[DEFAULT_PORTAL_KEY] = normalizePortal(portal);
  return context;
}

export function registerPortalScope(
  sessionManager: SessionManager,
  sessionId: string | undefined,
  portal: string,
  scopedSessionId: string,
  credentialsIdentity: string
): PortalScopeRecord {
  const { context, scopes } = getScopeMapFromContext(sessionManager, sessionId);
  const normalizedPortal = normalizePortal(portal);
  const record: PortalScopeRecord = {
    portal: normalizedPortal,
    sessionId: scopedSessionId,
    credentialsIdentity,
    lastUsedAt: new Date().toISOString(),
  };

  scopes[normalizedPortal] = record;
  context.variables[PORTAL_SCOPES_KEY] = scopes;
  return record;
}

export function getPortalScope(
  sessionManager: SessionManager,
  sessionId: string | undefined,
  portal: string
): PortalScopeRecord | undefined {
  const { scopes } = getScopeMapFromContext(sessionManager, sessionId);
  return scopes[normalizePortal(portal)];
}

export function listPortalScopes(
  sessionManager: SessionManager,
  sessionId?: string
): PortalScopeRecord[] {
  const { scopes } = getScopeMapFromContext(sessionManager, sessionId);
  return Object.values(scopes).sort((left, right) => left.portal.localeCompare(right.portal));
}

export function getVisibleVariables(
  variables: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(variables).filter(([key]) => key !== PORTAL_SCOPES_KEY)
  );
}

export function getVisibleVariableKeys(variables: Record<string, unknown>): string[] {
  return Object.keys(getVisibleVariables(variables));
}

export { DEFAULT_PORTAL_KEY };
