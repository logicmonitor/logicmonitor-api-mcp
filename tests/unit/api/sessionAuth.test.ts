import http from 'http';
import { once } from 'events';
import { fetchAvailablePortals, fetchPortalSession, PortalSession } from '../../../src/api/sessionAuth.js';
import { createListenerCredentials, createSessionCredentials } from '../../../src/auth/lmCredentials.js';

describe('sessionAuth', () => {
  async function withListener(
    handler: http.RequestListener,
    testFn: (baseUrl: string) => Promise<void>
  ): Promise<void> {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Failed to bind test listener');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      await testFn(baseUrl);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  }

  it('loads and validates a portal session from the listener', async () => {
    await withListener(async (req, res) => {
      expect(req.url).toBe('/api/v1/portal/prod');
      expect(req.headers['x-lm-listener-session-access']).toBe('READ_SESSION portal prod');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          jSessionID: 'abc123',
          token: 'csrf456',
          domain: 'portal.logicmonitor.com',
        }
      }));
    }, async (baseUrl) => {
      const credentials = createSessionCredentials('prod', baseUrl);
      const session = await fetchPortalSession(credentials, 1000);

      expect(session).toBeInstanceOf(PortalSession);
      expect(session.portalName).toBe('prod');
      expect(session.jSessionId).toBe('abc123');
      expect(session.csrfToken).toBe('csrf456');
      expect(session.portalBaseUrl).toBe('https://prod.logicmonitor.com');
    });
  });

  it('loads available portals from the listener', async () => {
    await withListener((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        portals: ['Prod', 'GovPortal']
      }));
    }, async (baseUrl) => {
      await expect(
        fetchAvailablePortals(createListenerCredentials(undefined, baseUrl), 1000)
      ).resolves.toEqual(['prod', 'govportal']);
    });
  });

  it('derives the correct gov portal base URL from the listener payload', async () => {
    await withListener((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          jSessionID: 'gov123',
          token: 'csrf789',
          domain: 'secure.lmgov.us',
        }
      }));
    }, async (baseUrl) => {
      const credentials = createSessionCredentials('gov', baseUrl);
      const session = await fetchPortalSession(credentials, 1000);

      expect(session.portalBaseUrl).toBe('https://gov.lmgov.us');
    });
  });

  it('includes loaded portals when a portal session is missing', async () => {
    await withListener((req, res) => {
      if (req.url === '/api/v1/portal/missing') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'missing' }));
        return;
      }

      if (req.url === '/api/v1/portals') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ portals: ['prod', 'gov'] }));
        return;
      }

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unexpected' }));
    }, async (baseUrl) => {
      const credentials = createSessionCredentials('missing', baseUrl);

      await expect(fetchPortalSession(credentials, 1000)).rejects.toMatchObject({
        name: 'LogicMonitorApiError',
        message: expect.stringContaining('Loaded portals: prod, gov'),
      });
    });
  });

  it('raises a LogicMonitorApiError when the listener payload is invalid', async () => {
    await withListener((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          jSessionID: 'abc123',
          domain: 'portal.logicmonitor.com',
        }
      }));
    }, async (baseUrl) => {
      const credentials = createSessionCredentials('prod', baseUrl);

      await expect(fetchPortalSession(credentials, 1000)).rejects.toMatchObject({
        name: 'LogicMonitorApiError',
        code: 'SESSION_AUTH_ERROR',
      });
    });
  });
});
