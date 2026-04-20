import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { fetchAvailablePortals } from '../api/sessionAuth.js';
import {
  createSessionCredentials,
  type LMCredentials,
  type ResolvedLMCredentials,
  normalizePortal,
} from './lmCredentials.js';

export interface CredentialResolutionOptions {
  portal?: unknown;
  sessionDefaultPortal?: string;
  timeoutMs: number;
}

export interface CredentialResolutionResult {
  credentials: ResolvedLMCredentials;
  portalSource: 'bearer' | 'explicit' | 'sessionDefault' | 'configDefault' | 'legacy';
  resolvedPortal?: string;
}

function normalizeOptionalPortal(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? normalizePortal(trimmed) : undefined;
}

export async function resolveCredentialsForOperation(
  baseCredentials: LMCredentials,
  options: CredentialResolutionOptions
): Promise<CredentialResolutionResult> {
  if (baseCredentials.kind === 'bearer') {
    return {
      credentials: baseCredentials,
      portalSource: 'bearer',
    };
  }

  const explicitPortal = normalizeOptionalPortal(options.portal);

  if (baseCredentials.kind === 'session') {
    const resolvedPortal = explicitPortal ?? baseCredentials.lm_portal;
    return {
      credentials: createSessionCredentials(
        resolvedPortal,
        baseCredentials.lm_session_listener_base_url
      ),
      portalSource: explicitPortal ? 'explicit' : 'legacy',
      resolvedPortal,
    };
  }

  const sessionDefaultPortal = normalizeOptionalPortal(options.sessionDefaultPortal);
  const configuredDefaultPortal = normalizeOptionalPortal(baseCredentials.lm_default_portal);
  const resolvedPortal = explicitPortal ?? sessionDefaultPortal ?? configuredDefaultPortal;

  if (!resolvedPortal) {
    let availablePortals: string[] = [];

    try {
      availablePortals = await fetchAvailablePortals(baseCredentials, options.timeoutMs);
    } catch {
      availablePortals = [];
    }

    const availablePortalsSuffix = availablePortals.length > 0
      ? ` Available portals: ${availablePortals.join(', ')}.`
      : '';

    throw new McpError(
      ErrorCode.InvalidParams,
      `No LogicMonitor portal could be resolved for this tool call. Pass 'portal', set lm_session key 'defaultPortal', or configure LM_PORTAL.${availablePortalsSuffix}`
    );
  }

  return {
    credentials: createSessionCredentials(
      resolvedPortal,
      baseCredentials.lm_session_listener_base_url
    ),
    portalSource: explicitPortal
      ? 'explicit'
      : sessionDefaultPortal
        ? 'sessionDefault'
        : 'configDefault',
    resolvedPortal,
  };
}
