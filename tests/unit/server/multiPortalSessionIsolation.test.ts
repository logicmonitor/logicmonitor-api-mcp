import { jest } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import winston from 'winston';
import { LogicMonitorClient } from '../../../src/api/client.js';
import { createListenerCredentials, createSessionCredentials, serializeCredentialsIdentity } from '../../../src/auth/lmCredentials.js';
import { createServer } from '../../../src/server.js';
import { buildScopedSessionId, listPortalScopes } from '../../../src/session/portalSessionState.js';
import { SessionManager } from '../../../src/session/sessionManager.js';

describe('multi-portal session isolation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps applyToPrevious state isolated per portal within the same MCP session', async () => {
    jest.spyOn(LogicMonitorClient.prototype, 'listDevices').mockImplementation(async function () {
      const portal = this.getAccount();
      const deviceId = portal === 'portal-a' ? 101 : 202;

      return {
        items: [{ id: deviceId, displayName: `${portal}-device` }],
        total: 1,
        raw: { items: [{ id: deviceId }] },
        meta: {
          endpoint: '/device/devices',
          method: 'get',
          status: 200,
          timestamp: new Date().toISOString(),
        },
      };
    });

    const sessionManager = new SessionManager();
    const logger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })],
    });

    const { server } = await createServer({
      credentials: createListenerCredentials(undefined, 'http://127.0.0.1:8072'),
      sessionManager,
      logger,
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    serverTransport.sessionId = 'shared-session';
    await server.server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    await client.callTool({
      name: 'lm_device',
      arguments: {
        operation: 'list',
        portal: 'portal-a',
      },
    });

    await client.callTool({
      name: 'lm_device',
      arguments: {
        operation: 'list',
        portal: 'portal-b',
      },
    });

    const portalASessionId = buildScopedSessionId(
      'shared-session',
      serializeCredentialsIdentity(createSessionCredentials('portal-a', 'http://127.0.0.1:8072'))
    );
    const portalBSessionId = buildScopedSessionId(
      'shared-session',
      serializeCredentialsIdentity(createSessionCredentials('portal-b', 'http://127.0.0.1:8072'))
    );

    expect(sessionManager.getContext(portalASessionId).variables.lastDeviceListIds).toEqual([101]);
    expect(sessionManager.getContext(portalBSessionId).variables.lastDeviceListIds).toEqual([202]);
    expect(listPortalScopes(sessionManager, 'shared-session').map(scope => scope.portal)).toEqual([
      'portal-a',
      'portal-b',
    ]);

    await client.close();
    await server.close();
  });
});
