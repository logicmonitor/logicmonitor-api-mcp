/**
 * Test data generators and fixtures
 */

import { generateTestResourceName } from './testHelpers.js';

/**
 * Generate a test device payload
 */
export function generateDevicePayload(options: {
  collectorId: number;
  groupIds?: number[];
  displayName?: string;
  customProperties?: Array<{ name: string; value: string }>;
} = { collectorId: 1 }) {
  const displayName = options.displayName || generateTestResourceName('device');
  
  return {
    displayName,
    name: `${displayName}.test.local`,
    hostGroupIds: options.groupIds || [1],
    preferredCollectorId: options.collectorId,
    disableAlerting: true,
    customProperties: options.customProperties || [
      { name: 'test.resource', value: 'true' },
      { name: 'test.timestamp', value: Date.now().toString() },
    ],
  };
}

/**
 * Generate multiple test device payloads
 */
export function generateDevicePayloads(count: number, collectorId: number): Array<ReturnType<typeof generateDevicePayload>> {
  return Array.from({ length: count }, (_, i) => 
    generateDevicePayload({
      collectorId,
      displayName: generateTestResourceName(`device-${i + 1}`),
    })
  );
}

/**
 * Generate a test device group payload
 */
export function generateDeviceGroupPayload(options: {
  parentId?: number;
  name?: string;
  description?: string;
} = {}) {
  const name = options.name || generateTestResourceName('group');
  
  return {
    name,
    parentId: options.parentId || 1,
    description: options.description || `Test device group - ${name}`,
    customProperties: [
      { name: 'test.resource', value: 'true' },
      { name: 'test.timestamp', value: Date.now().toString() },
    ],
  };
}

/**
 * Generate a test website payload
 */
export function generateWebsitePayload(options: {
  groupId?: number;
  name?: string;
  domain?: string;
  type?: 'webcheck' | 'pingcheck';
} = {}) {
  const name = options.name || generateTestResourceName('website');
  const domain = options.domain || `${name}.test.local`;
  
  return {
    name,
    domain,
    type: options.type || 'webcheck',
    groupId: options.groupId || 1,
    disableAlerting: true,
    useDefaultLocationSetting: true,
    useDefaultAlertSetting: true,
    properties: [
      { name: 'test.resource', value: 'true' },
      { name: 'test.timestamp', value: Date.now().toString() },
    ],
    steps: [
      {
        type: 'config',
        name: '__step0',
        description: '',
        enable: true,
        label: '',
        HTTPHeaders: '',
        followRedirection: true,
        HTTPBody: '',
        HTTPMethod: 'GET',
        postDataEditType: null,
        fullpageLoad: false,
        requireAuth: false,
        auth: null,
        timeout: 30,
        HTTPVersion: '1.1',
        schema: 'http',
        url: '',
        matchType: 'plain',
        keyword: '',
        path: '',
        invertMatch: false,
        statusCode: '',
        reqScript: '',
        reqType: 'config',
        respType: 'config',
        respScript: '',
        useDefaultRoot: true,
      },
    ],
  };
}

/**
 * Generate a test website group payload
 */
export function generateWebsiteGroupPayload(options: {
  parentId?: number;
  name?: string;
  description?: string;
} = {}) {
  const name = options.name || generateTestResourceName('website-group');
  
  return {
    name,
    parentId: options.parentId || 1,
    description: options.description || `Test website group - ${name}`,
    disableAlerting: true,
    properties: [
      { name: 'test.resource', value: 'true' },
    ],
  };
}

/**
 * Generate a test user payload
 */
export function generateUserPayload(options: {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: number[] | Array<{ id: number }>;
} = {}) {
  const timestamp = Date.now();
  const username = options.username || `mcp-test-user-${timestamp}`;

  if (!options.roles || options.roles.length === 0) {
    throw new Error('generateUserPayload requires explicit roles for the target LogicMonitor portal');
  }

  // Convert roles to the correct format if needed
  let roles: Array<{ id: number }>;
  if (typeof options.roles[0] === 'number') {
    roles = (options.roles as number[]).map(id => ({ id }));
  } else {
    roles = options.roles as Array<{ id: number }>;
  }
  
  return {
    username,
    email: options.email || `${username}@example.com`,
    status: 'suspended',
    firstName: options.firstName || 'Test',
    lastName: options.lastName || 'McpTest',
    roles,
    forcePasswordChange: true,
    apionly: true,
    note: 'Test user created by MCP test suite',
  };
}

/**
 * Generate a test collector group payload
 */
export function generateCollectorGroupPayload(options: {
  name?: string;
  description?: string;
  autoBalance?: boolean;
} = {}) {
  const name = options.name || generateTestResourceName('collector-group');
  
  return {
    name,
    description: options.description || `Test collector group - ${name}`,
    autoBalance: options.autoBalance || false,
    customProperties: [
      { name: 'test.resource', value: 'true' },
    ],
  };
}

/**
 * Generate a test dashboard payload
 */
export function generateDashboardPayload(options: {
  name?: string;
  groupId?: number;
  description?: string;
  sharable?: boolean;
} = {}) {
  const name = options.name || generateTestResourceName('dashboard');
  
  return {
    name,
    groupId: options.groupId || 1,
    description: options.description || `Test dashboard - ${name}`,
    widgetsConfig: '{}',
    widgetTokens: [
      { name: 'test.resource', value: 'true' },
    ],
    sharable: options.sharable ?? true,
  };
}

/**
 * Common test filters
 */
export const TEST_FILTERS = {
  testDevices: `displayName:${global.testConfig.testResourcePrefix}*`,
  testGroups: `name:${global.testConfig.testResourcePrefix}*`,
  activeCollectors: 'status:1',
  aliveDevices: 'hostStatus:alive',
  criticalAlerts: 'severity>:2',
  unclearedAlerts: 'cleared:false',
};

/**
 * Common field selections
 */
export const FIELD_SELECTIONS = {
  device: {
    minimal: 'id,displayName,name',
    standard: 'id,displayName,name,hostStatus,preferredCollectorId',
    full: '*',
  },
  deviceGroup: {
    minimal: 'id,name,fullPath',
    standard: 'id,name,fullPath,parentId,numOfDirectDevices',
    full: '*',
  },
  collector: {
    minimal: 'id,description',
    standard: 'id,description,status,platform',
    full: '*',
  },
  alert: {
    minimal: 'id,severity,resourceId',
    standard: 'id,severity,resourceId,startEpoch,monitorObjectName,cleared',
    full: '*',
  },
};
