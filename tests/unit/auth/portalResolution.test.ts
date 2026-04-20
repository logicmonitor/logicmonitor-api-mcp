import http from 'http';
import { once } from 'events';
import { resolveCredentialsForOperation } from '../../../src/auth/portalResolution.js';
import {
  createBearerCredentials,
  createListenerCredentials,
} from '../../../src/auth/lmCredentials.js';

describe('portalResolution', () => {
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

  it('prefers explicit portal over session and config defaults', async () => {
    const result = await resolveCredentialsForOperation(
      createListenerCredentials('config-default', 'http://127.0.0.1:8072'),
      {
        portal: 'Explicit-Portal',
        sessionDefaultPortal: 'session-default',
        timeoutMs: 1000,
      }
    );

    expect(result).toEqual({
      credentials: {
        kind: 'session',
        lm_portal: 'explicit-portal',
        lm_session_listener_base_url: 'http://127.0.0.1:8072',
      },
      portalSource: 'explicit',
      resolvedPortal: 'explicit-portal',
    });
  });

  it('falls back to the session default portal before the configured default', async () => {
    const result = await resolveCredentialsForOperation(
      createListenerCredentials('config-default', 'http://127.0.0.1:8072'),
      {
        sessionDefaultPortal: 'session-default',
        timeoutMs: 1000,
      }
    );

    expect(result.credentials).toEqual({
      kind: 'session',
      lm_portal: 'session-default',
      lm_session_listener_base_url: 'http://127.0.0.1:8072',
    });
    expect(result.portalSource).toBe('sessionDefault');
  });

  it('passes bearer credentials through unchanged', async () => {
    const credentials = createBearerCredentials('acme', 'secret');
    await expect(
      resolveCredentialsForOperation(credentials, { timeoutMs: 1000 })
    ).resolves.toEqual({
      credentials,
      portalSource: 'bearer',
    });
  });

  it('surfaces listener portals when no portal can be resolved', async () => {
    await withListener((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ portals: ['alpha', 'beta'] }));
    }, async (baseUrl) => {
      await expect(
        resolveCredentialsForOperation(
          createListenerCredentials(undefined, baseUrl),
          { timeoutMs: 1000 }
        )
      ).rejects.toMatchObject({
        message: expect.stringContaining('Available portals: alpha, beta'),
      });
    });
  });
});
