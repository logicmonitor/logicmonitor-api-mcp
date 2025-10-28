export interface LMDevice {
  id: number;
  displayName: string;
  name: string;
  hostGroupIds: string;  // Actually a comma-separated string like "16,4,3"
  preferredCollectorId?: number;
  preferredCollectorGroupId?: number;
  disableAlerting: boolean;
  enableNetflow: boolean;
  customProperties: Array<{
    name: string;
    value: string;
  }>;
  systemProperties: Array<{
    name: string;
    value: string;
  }>;
  autoProperties: Array<{
    name: string;
    value: string;
  }>;
  inheritedProperties: Array<{
    name: string;
    value: string;
  }>;
  createdOn: number;
  updatedOn: number;
  hostStatus: string;
  alertStatus: string;
  alertStatusPriority: number;
  alertDisableStatus: string;
  sdtStatus: string;
}

export interface LMDeviceGroup {
  id: number;
  name: string;
  description: string;
  parentId: number;
  fullPath: string;
  appliesTo?: string;
  disableAlerting: boolean;
  defaultCollectorId?: number;
  defaultCollectorGroupId?: number;
  customProperties: Array<{
    name: string;
    value: string;
  }>;
  systemProperties: Array<{
    name: string;
    value: string;
  }>;
  inheritedProperties: Array<{
    name: string;
    value: string;
  }>;
  createdOn: number;
  updatedOn: number;
  numOfDirectDevices: number;
  numOfDirectSubGroups: number;
  numOfDevices: number;
  numOfSubGroups: number;
  alertStatus: string;
  sdtStatus: string;
}

export interface LMPaginatedResponse<T> {
  total: number;
  searchId?: string;
  items: T[];
}

export interface LMCollector {
  id: number;
  description: string;
  hostname: string;
  status: string;
  platform: string;
  version: string;
  build: string;
  arch: string;
  collectorSize: string;
  collectorGroupId: number;
  collectorGroupName: string;
  escalatingChainId: number;
  enableFailBack: boolean;
  numberOfInstances: number;
  numberOfSDTs: number;
  isDown: boolean;
  uptime: number;
  enableFailOverOnCollectorDevice: boolean;
  resendIval: number;
  suppressAlertClear: boolean;
  userPermission: string;
  createdOn: number;
  updatedOn: number;
  needAutoCreateCollectorDevice: boolean;
  collectorDeviceId: number;
  numberOfHosts: number;
  inSDT: boolean;
  lastSentNotificationOn: number;
  hasFailOverDevice: boolean;
  onetimeUpgradeInfo: string;
  watchdogUpdatedOn: number;
  watchdogProcessUpdatedOn: number;
  customProperties: Array<{
    name: string;
    value: string;
  }>;
}

export interface LMErrorResponse {
  status?: number;
  errmsg?: string;
  errorMessage?: string;
  errorCode?: string;
}

export interface LMAlert {
  id: string;
  internalId: string;
  type: string;
  startEpoch: number;
  endEpoch?: number;
  acked: boolean;
  ackedBy?: string;
  ackedEpoch?: number;
  ackComment?: string;
  rule: string;
  chain: string;
  severity: number;
  cleared: boolean;
  clearValue?: string;
  clearExpr?: string;
  sdted: boolean;
  SDT?: Record<string, unknown>;
  suppressDesc?: string;
  suppressor?: string;
  threshold: string;
  alertValue: string;
  dataPointId: number;
  dataPointName: string;
  instanceId: number;
  instanceName: string;
  instanceDescription?: string;
  monitorObjectId: number;
  monitorObjectName: string;
  monitorObjectType: string;
  monitorObjectGroups?: Record<string, unknown>;
  resourceId: number;
  resourceTemplateId?: number;
  resourceTemplateName?: string;
  resourceTemplateType?: string;
  tenant: string;
  anomaly: boolean;
  adAlert: boolean;
  adAlertDesc?: string;
  ruleId: number;
  chainId: number;
  subChainId?: number;
  nextRecipient?: number;
  receivedList?: string;
  dependencyRoutingState?: string;
  dependencyRole?: string;
  enableAnomalyAlertGeneration?: string;
  enableAnomalyAlertSuppression?: string;
  alertQuery?: string;
  alertGroupEntityValue?: string;
  logPartition?: string;
  logMetaData?: string;
  alertExternalTicketUrl?: {
    empty: boolean;
  };
  customColumns?: Record<string, string>;
}

export interface LMAlertPaginatedResponse extends LMPaginatedResponse<LMAlert> {
  // For alerts, total can be negative to indicate "at least" that many results
  total: number;
  needMessage?: boolean;
}

export interface LMWebsite {
  id: number;
  name: string;
  description: string;
  domain: string;
  type: 'webcheck' | 'pingcheck';
  groupId: number;
  status: string;
  disableAlerting: boolean;
  stopMonitoring: boolean;
  stopMonitoringByFolder: boolean;
  useDefaultAlertSetting: boolean;
  useDefaultLocationSetting: boolean;
  individualAlertLevel: 'warn' | 'error' | 'critical';
  individualSmAlertEnable: boolean;
  overallAlertLevel: 'warn' | 'error' | 'critical';
  pollingInterval: number;
  transition: number;
  globalSmAlertCond: number;
  isInternal: boolean;
  lastUpdated: number;
  userPermission: string;
  rolePrivileges: string[];
  template?: Record<string, unknown>;
  testLocation: {
    all: boolean;
    collectorIds: number[];
    collectors: Array<{
      hostname: string;
      collectorGroupName: string;
      collectorGroupId: number;
      description: string;
      id: number;
      status: string;
    }>;
    smgIds: number[];
  };
  checkpoints: Array<{
    geoInfo: string;
    id: number;
    smgId: number;
  }>;
  steps: Array<{
    schema: string;
    respType: string;
    HTTPHeaders: string;
    auth?: {
      password: string;
      type: string;
      userName: string;
    };
    matchType: string;
    description: string;
    type: string;
    timeout: number;
    useDefaultRoot: boolean;
    path: string;
    HTTPMethod: string;
    enable: boolean;
    HTTPVersion: string;
    keyword: string;
    respScript: string;
    label: string;
    url: string;
    invertMatch: boolean;
    reqScript: string;
    HTTPBody: string;
    followRedirection: boolean;
    postDataEditType: string;
    name: string;
    requireAuth: boolean;
    reqType: string;
    fullpageLoad: boolean;
    statusCode: string;
  }>;
  collectors: Array<{
    hostname: string;
    collectorGroupName: string;
    collectorGroupId: number;
    description: string;
    id: number;
    status: string;
  }>;
  properties: Array<{
    name: string;
    value: string;
  }>;
}

export interface LMWebsiteGroup {
  id: number;
  name: string;
  description: string;
  parentId: number;
  fullPath: string;
  numOfWebsites: number;
  numOfDirectWebsites: number;
  numOfDirectSubGroups: number;
  hasWebsitesDisabled: boolean;
  disableAlerting: boolean;
  stopMonitoring: boolean;
  userPermission: string;
  rolePrivileges: string[];
  testLocation?: {
    all: boolean;
    collectorIds: number[];
    collectors: Array<{
      hostname: string;
      collectorGroupName: string;
      collectorGroupId: number;
      description: string;
      id: number;
      status: string;
    }>;
    smgIds: number[];
  };
  properties: Array<{
    name: string;
    value: string;
  }>;
}
