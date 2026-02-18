interface BaseArgs {
  company: string;
}

interface WithGroups {
  groupIds?: Array<number | string | null | undefined>;
}

export interface DashboardLinkArgs extends BaseArgs, WithGroups {
  dashboardId: number | string;
}

export interface DeviceLinkArgs extends BaseArgs, WithGroups {
  deviceId: number | string;
}

export interface WebsiteLinkArgs extends BaseArgs, WithGroups {
  websiteId: number | string;
}

export interface AlertLinkArgs extends BaseArgs {
  alertId: number | string;
}

function normalizeCompany(company: string | undefined): string {
  if (!company || !company.trim()) {
    throw new Error('LogicMonitor company subdomain is required to build URLs.');
  }
  return company.trim().toLowerCase();
}

function ensureId(id: number | string | undefined, label: string): string {
  if (id === null || typeof id === 'undefined' || `${id}`.trim().length === 0) {
    throw new Error(`${label} is required to build URLs.`);
  }
  return `${id}`.trim();
}

function baseUrl(company: string): string {
  const normalized = normalizeCompany(company);
  return `https://${normalized}.logicmonitor.com/santaba/uiv4`;
}

function buildGroupSegments(
  prefix: string,
  groupIds?: Array<number | string | null | undefined>
): string[] {
  if (!groupIds || groupIds.length === 0) {
    return [];
  }
  return groupIds
    .filter((value): value is number | string => !(value === null || typeof value === 'undefined'))
    .map(value => `${prefix}-${value}`);
}

export function getDashboardLink(args: DashboardLinkArgs): string {
  const dashboardId = ensureId(args.dashboardId, 'dashboardId');
  const segments = [
    ...buildGroupSegments('dashboardGroups', args.groupIds),
    `dashboards-${dashboardId}`
  ];
  return `${baseUrl(args.company)}/dashboards/${segments.join(',')}`;
}

export function getDeviceLink(args: DeviceLinkArgs): string {
  const deviceId = ensureId(args.deviceId, 'deviceId');
  const idSegment = encodeURIComponent(deviceId);
  return `${baseUrl(args.company)}/resources/treeNodes/t-d,id-${idSegment}?source=details&tab=info`;
}

export function getWebsiteLink(args: WebsiteLinkArgs): string {
  const websiteId = ensureId(args.websiteId, 'websiteId');
  const idSegment = encodeURIComponent(websiteId);
  return `${baseUrl(args.company)}/websites/treeNodes/t-s,id-${idSegment}?source=details&tab=info`;
}

export function getAlertLink(args: AlertLinkArgs): string {
  const alertId = ensureId(args.alertId, 'alertId');
  return `${baseUrl(args.company)}/alerts/${alertId}`;
}

