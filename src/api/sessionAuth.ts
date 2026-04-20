import axios from 'axios';
import { LogicMonitorApiError } from './errors.js';
import type { ListenerLMCredentials, SessionLMCredentials } from '../auth/lmCredentials.js';

const LISTENER_SESSION_ACCESS_HEADER = 'X-LM-Listener-Session-Access';

export class PortalSession {
  constructor(
    public readonly portalName: string,
    public readonly jSessionId: string,
    public readonly csrfToken: string,
    public readonly domain: string
  ) {}

  static fromExtensionPayload(portalName: string, payload: unknown): PortalSession {
    const normalizedPortal = String(portalName || '').trim().toLowerCase();
    if (!normalizedPortal) {
      throw new Error('Portal name is required.');
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Session payload must be a JSON object.');
    }

    const record = payload as Record<string, unknown>;
    const jSessionId = String(record.jSessionID || '').trim();
    const csrfToken = String(record.token || '').trim();
    const domain = String(record.domain || '').trim();

    const missingFields = [
      !jSessionId ? 'jSessionID' : null,
      !csrfToken ? 'token' : null,
      !domain ? 'domain' : null,
    ].filter(Boolean);

    if (missingFields.length > 0) {
      throw new Error(
        `Session payload is missing required non-empty field(s): ${missingFields.join(', ')}.`
      );
    }

    return new PortalSession(normalizedPortal, jSessionId, csrfToken, domain);
  }

  get normalizedDomain(): string {
    const lowered = this.domain.trim().toLowerCase();
    if (lowered.includes('lmgov.us')) {
      return 'lmgov.us';
    }

    return 'logicmonitor.com';
  }

  get portalBaseUrl(): string {
    return `https://${this.portalName}.${this.normalizedDomain}`;
  }
}

function buildSessionAccessToken(portalName: string): string {
  return `READ_SESSION portal ${portalName.trim().toLowerCase()}`;
}

function normalizeLoadedPortals(payload: unknown): string[] {
  if (payload === null || typeof payload === 'undefined') {
    return [];
  }

  const source = Array.isArray(payload)
    ? payload
    : (payload as Record<string, unknown>).portals;

  if (!Array.isArray(source) || (source.length === 1 && source[0] === 'None')) {
    return [];
  }

  return source
    .map(portal => String(portal || '').trim().toLowerCase())
    .filter(Boolean);
}

function getListenerBaseUrl(credentials: SessionLMCredentials | ListenerLMCredentials | string): string {
  const baseUrl = typeof credentials === 'string'
    ? credentials
    : credentials.lm_session_listener_base_url;
  return baseUrl.replace(/\/+$/, '');
}

export async function fetchAvailablePortals(
  credentials: SessionLMCredentials | ListenerLMCredentials | string,
  timeoutMs: number
): Promise<string[]> {
  const baseUrl = getListenerBaseUrl(credentials);
  const url = `${baseUrl}/api/v1/portals`;

  try {
    const response = await axios.get(url, { timeout: timeoutMs });
    return normalizeLoadedPortals(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new LogicMonitorApiError(
        `Failed to load available portals from ${url}.`,
        {
          status: error.response?.status,
          code: 'SESSION_AUTH_ERROR',
          requestUrl: url,
          requestMethod: 'GET',
          responseBody: error.response?.data,
        }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new LogicMonitorApiError(
      `Listener response from ${url} did not contain a valid portal list: ${message}`,
      {
        code: 'SESSION_AUTH_ERROR',
        requestUrl: url,
        requestMethod: 'GET',
      }
    );
  }
}

export async function fetchPortalSession(
  credentials: SessionLMCredentials,
  timeoutMs: number
): Promise<PortalSession> {
  const portal = credentials.lm_portal.trim().toLowerCase();
  const baseUrl = getListenerBaseUrl(credentials);
  const url = `${baseUrl}/api/v1/portal/${encodeURIComponent(portal)}`;

  try {
    const response = await axios.get(url, {
      headers: {
        [LISTENER_SESSION_ACCESS_HEADER]: buildSessionAccessToken(portal),
      },
      timeout: timeoutMs,
    });

    return PortalSession.fromExtensionPayload(portal, response.data?.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      let message = `Failed to load portal session for '${portal}' from ${url}.`;

      if (status === 404) {
        const availablePortals = await fetchAvailablePortals(credentials, timeoutMs).catch(
          () => []
        );

        message = availablePortals.length > 0
          ? `No active portal session for '${portal}' was found at ${baseUrl}. Loaded portals: ${availablePortals.join(', ')}. Refresh the target LogicMonitor portal page while the listener is running, or query one of the already loaded portals instead.`
          : `No active portal session for '${portal}' was found at ${baseUrl}. The listener is running but no portals are currently loaded. Refresh the target LogicMonitor portal page while the listener is running so the browser extension can repost the session.`;
      }

      throw new LogicMonitorApiError(message, {
        status,
        code: 'SESSION_AUTH_ERROR',
        requestUrl: url,
        requestMethod: 'GET',
        responseBody: error.response?.data,
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new LogicMonitorApiError(
      `Listener response for portal '${portal}' contained an invalid session payload: ${message}`,
      {
        code: 'SESSION_AUTH_ERROR',
        requestUrl: url,
        requestMethod: 'GET',
      }
    );
  }
}
