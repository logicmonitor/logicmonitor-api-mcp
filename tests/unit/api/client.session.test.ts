import http from 'http';
import { once } from 'events';
import { LogicMonitorClient } from '../../../src/api/client.js';
import { createSessionCredentials } from '../../../src/auth/lmCredentials.js';

describe('LogicMonitorClient session auth', () => {
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

  it('prepares session-authenticated requests with portal-specific headers and base URL', async () => {
    await withListener((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          jSessionID: 'jsession-123',
          token: 'csrf-456',
          domain: 'secure.lmgov.us',
        }
      }));
    }, async (baseUrl) => {
      const credentials = createSessionCredentials('gov', baseUrl);
      const client = new LogicMonitorClient(credentials);

      const requestConfig = await (client as unknown as {
        attachSessionAuth: (
          creds: typeof credentials,
          timeoutMs: number,
          request: { headers?: Record<string, string> }
        ) => Promise<{ baseURL?: string; headers: { get: (key: string) => string | undefined } }>;
      }).attachSessionAuth(credentials, 1000, { headers: {} });

      expect(requestConfig.baseURL).toBe('https://gov.lmgov.us/santaba/rest');
      expect(requestConfig.headers.get('cookie')).toBe('JSESSIONID=jsession-123;');
      expect(requestConfig.headers.get('x-csrf-token')).toBe('csrf-456');
      expect(client.getPortalUiBaseUrl()).toBe('https://gov.lmgov.us/santaba/uiv4');
    });
  });
});
