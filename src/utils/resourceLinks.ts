/**
 * LogicMonitor portal URL builders for resource links.
 */

export interface DashboardLinkArgs {
  portalUiBaseUrl: string;
  dashboardId: number | string;
  groupIds?: Array<number | string | null | undefined>;
}

export interface DeviceLinkArgs {
  portalUiBaseUrl: string;
  deviceId: number | string;
}

export interface WebsiteLinkArgs {
  portalUiBaseUrl: string;
  websiteId: number | string;
}

export interface AlertLinkArgs {
  portalUiBaseUrl: string;
  alertId: number | string;
}

function normalizePortalUiBaseUrl(portalUiBaseUrl: string | undefined): string {
  if (!portalUiBaseUrl || !portalUiBaseUrl.trim()) {
    throw new Error('LogicMonitor portal UI base URL is required to build URLs.');
  }
  return portalUiBaseUrl.trim().replace(/\/+$/, '');
}

function ensureId(id: number | string | undefined, label: string): string {
  if (id === null || typeof id === 'undefined' || `${id}`.trim().length === 0) {
    throw new Error(`${label} is required to build URLs.`);
  }
  return `${id}`.trim();
}

export function getDashboardLink(args: DashboardLinkArgs): string {
  const dashboardId = ensureId(args.dashboardId, 'dashboardId');
  const groupSegments = (args.groupIds ?? [])
    .filter((v): v is number | string => v != null)
    .map(v => `dashboardGroups-${v}`);
  const segments = [...groupSegments, `dashboards-${dashboardId}`];
  return `${normalizePortalUiBaseUrl(args.portalUiBaseUrl)}/dashboards/${segments.join(',')}`;
}

export function getDeviceLink(args: DeviceLinkArgs): string {
  const deviceId = ensureId(args.deviceId, 'deviceId');
  return `${normalizePortalUiBaseUrl(args.portalUiBaseUrl)}/resources/treeNodes/t-d,id-${encodeURIComponent(deviceId)}?source=details&tab=info`;
}

export function getWebsiteLink(args: WebsiteLinkArgs): string {
  const websiteId = ensureId(args.websiteId, 'websiteId');
  return `${normalizePortalUiBaseUrl(args.portalUiBaseUrl)}/websites/treeNodes/t-s,id-${encodeURIComponent(websiteId)}?source=details&tab=info`;
}

export function getAlertLink(args: AlertLinkArgs): string {
  const alertId = ensureId(args.alertId, 'alertId');
  return `${normalizePortalUiBaseUrl(args.portalUiBaseUrl)}/alerts/${alertId}`;
}
