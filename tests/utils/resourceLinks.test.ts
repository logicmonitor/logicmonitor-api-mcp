import {
  getAlertLink,
  getDashboardLink,
  getDeviceLink,
  getWebsiteLink
} from '../../src/utils/resourceLinks.js';
import { createTestClient, TestMCPClient } from './testClient.js';
import { assertToolSuccess, extractToolData } from './testHelpers.js';

function buildPortalUiBaseUrl(account: string): string {
  return `https://${account.trim().toLowerCase()}.logicmonitor.com/santaba/uiv4`;
}

describe('resourceLinks', () => {
  const company = 'Example';
  const portalUiBaseUrl = buildPortalUiBaseUrl(company);

  it('builds dashboard link with group hierarchy', () => {
    const link = getDashboardLink({
      portalUiBaseUrl,
      groupIds: [1, 20],
      dashboardId: 42
    });
    expect(link).toBe(
      'https://example.logicmonitor.com/santaba/uiv4/dashboards/dashboardGroups-1,dashboardGroups-20,dashboards-42'
    );
  });

  it('builds dashboard link without groups', () => {
    const link = getDashboardLink({
      portalUiBaseUrl,
      dashboardId: 'main'
    });
    expect(link).toBe(
      'https://example.logicmonitor.com/santaba/uiv4/dashboards/dashboards-main'
    );
  });

  it('builds device link with simplified path', () => {
    const link = getDeviceLink({
      portalUiBaseUrl: buildPortalUiBaseUrl('myCompany'),
      deviceId: 99
    });
    expect(link).toBe(
      'https://mycompany.logicmonitor.com/santaba/uiv4/resources/treeNodes/t-d,id-99?source=details&tab=info'
    );
  });

  it('builds website link with simplified path', () => {
    const link = getWebsiteLink({
      portalUiBaseUrl,
      websiteId: 101
    });
    expect(link).toBe(
      'https://example.logicmonitor.com/santaba/uiv4/websites/treeNodes/t-s,id-101?source=details&tab=info'
    );
  });

  it('builds alert link', () => {
    const link = getAlertLink({
      portalUiBaseUrl,
      alertId: 'A-1234'
    });
    expect(link).toBe(
      'https://example.logicmonitor.com/santaba/uiv4/alerts/A-1234'
    );
  });

  it('throws when required identifiers are missing', () => {
    expect(() =>
      getDeviceLink({
        portalUiBaseUrl,
        deviceId: '' as unknown as number
      })
    ).toThrow('deviceId is required to build URLs.');
  });
});

describe('resource link samples (console output)', () => {
  let client: TestMCPClient;
  const account = global.testConfig?.lmAccount ?? 'example';
  const portalUiBaseUrl = process.env.LM_PORTAL_UI_BASE_URL || buildPortalUiBaseUrl(account);

  beforeAll(async () => {
    client = await createTestClient('resource-link-samples');
  });

  const sampleConfigs: Array<{
    label: string;
    tool: string;
  }> = [
    { label: 'dashboard', tool: 'lm_dashboard' },
    { label: 'device', tool: 'lm_device' },
    { label: 'website', tool: 'lm_website' },
    { label: 'alert', tool: 'lm_alert' }
  ];

  function parseGroupIds(value: unknown): Array<number | string> | undefined {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      const parsed = value.filter(v => !(v === null || typeof v === 'undefined'));
      return parsed.length ? parsed : undefined;
    }
    if (typeof value === 'string') {
      const parts = value
        .split(',')
        .map(segment => segment.trim())
        .filter(Boolean);
      return parts.length ? parts : undefined;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      return [Number(value)];
    }
    return undefined;
  }

  function buildLink(label: string, sample: unknown): string {
    if (!sample || typeof sample !== 'object') {
      return 'n/a';
    }

    try {
      switch (label) {
        case 'dashboard': {
          const dashboard = sample as { id?: unknown; groupId?: unknown };
          return getDashboardLink({
            portalUiBaseUrl,
            dashboardId: dashboard.id as number | string,
            groupIds: parseGroupIds(dashboard.groupId)
          });
        }
        case 'device': {
          const device = sample as { id?: unknown; hostGroupIds?: unknown };
          return getDeviceLink({
            portalUiBaseUrl,
            deviceId: device.id as number | string
          });
        }
        case 'website': {
          const website = sample as { id?: unknown; groupId?: unknown };
          return getWebsiteLink({
            portalUiBaseUrl,
            websiteId: website.id as number | string
          });
        }
        case 'alert': {
          const alert = sample as { id?: unknown };
          return getAlertLink({
            portalUiBaseUrl,
            alertId: alert.id as number | string
          });
        }
        default:
          return 'n/a';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `link-error: ${message}`;
    }
  }

  for (const config of sampleConfigs) {
    test(`logs sample ${config.label}`, async () => {
      const result = await client.callTool(config.tool, {
        operation: 'list',
        size: 1,
        autoPaginate: false,
      });

      assertToolSuccess(result);

      const data = extractToolData<{ items?: unknown[] }>(result);
      const items = Array.isArray(data.items) ? data.items : [];
      const sample = items[0] ?? null;
      const link = buildLink(config.label, sample);

      console.log(`[resource-links] sample ${config.label} link: ${link}`);

      expect(Array.isArray(items)).toBe(true);
    }, 30000);
  }
});
