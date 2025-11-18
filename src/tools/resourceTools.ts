/**
 * Resource-based tool definitions
 * Replaces operation-specific tools with resource-based tools
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const operationEnum = {
  type: 'string',
  enum: ['list', 'get', 'create', 'update', 'delete'],
  description: 'The operation to perform on the resource'
};

const batchOptionsSchema = {
  type: 'object',
  properties: {
    maxConcurrent: {
      type: 'number',
      minimum: 1,
      maximum: 50,
      description: 'Maximum concurrent requests (default: 5)'
    },
    continueOnError: {
      type: 'boolean',
      description: 'Continue processing if some items fail (default: true)'
    },
    dryRun: {
      type: 'boolean',
      description: 'Simulate the operation without making changes (default: false)'
    }
  }
};

export const resourceTools: Tool[] = [
  {
    name: 'lm_device',
    description: 'Manage LogicMonitor devices. Supports list, get, create, update, and delete operations. Batch operations support explicit arrays, applyToPrevious references, and filter-based operations.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: operationEnum,
        // Common parameters
        id: {
          type: 'number',
          description: 'Device ID (for get, update, delete). Can be omitted if referencing last operation.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. Use "*" for all fields. See resource health://logicmonitor/fields/device for available fields.'
        },
        // List operation
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string for list or batch operations. Examples: "name:*prod*", "hostStatus:alive". Available operators: >:, <:, >, <, !:, :, ~, !~'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          description: 'Results per page for list operation'
        },
        offset: {
          type: 'number',
          minimum: 0,
          description: 'Pagination offset for list operation'
        },
        // Create operation
        displayName: {
          type: 'string',
          description: 'Display name for the device (create)'
        },
        name: {
          type: 'string',
          description: 'Hostname or IP address (create)'
        },
        hostGroupIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of host group IDs (create/update)'
        },
        preferredCollectorId: {
          type: 'number',
          description: 'Preferred collector ID (create)'
        },
        disableAlerting: {
          type: 'boolean',
          description: 'Whether to disable alerting (create/update)'
        },
        customProperties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            }
          },
          description: 'Custom properties (create/update)'
        },
        // Batch operations
        devices: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of devices for batch create/update/delete operations'
        },
        updates: {
          type: 'object',
          description: 'Updates to apply in batch update operations. Only used with applyToPrevious or filter. Leave empty if not doing batch updates.',
          additionalProperties: true
        },
        applyToPrevious: {
          type: 'string',
          description: 'Session variable name to apply batch operation to (e.g., "lastDeviceList")'
        },
        batchOptions: batchOptionsSchema
      },
      required: ['operation']
    }
  },
  {
    name: 'lm_device_group',
    description: 'Manage LogicMonitor device groups. Supports list, get, create, update, and delete operations with batch support.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: operationEnum,
        id: {
          type: 'number',
          description: 'Device group ID (for get, update, delete). Can be omitted if referencing last operation.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. See resource health://logicmonitor/fields/device_group'
        },
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string. Examples: "name:*servers*", "parentId:1"'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          minimum: 0
        },
        // Create/Update
        name: {
          type: 'string',
          description: 'Group name'
        },
        parentId: {
          type: 'number',
          description: 'Parent group ID (create)'
        },
        description: {
          type: 'string',
          description: 'Group description'
        },
        appliesTo: {
          type: 'string',
          description: 'AppliesTo query for dynamic group membership'
        },
        customProperties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            }
          }
        },
        // Delete
        deleteChildren: {
          type: 'boolean',
          description: 'Whether to delete child groups (delete operation)'
        },
        // Batch
        groups: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of groups for batch operations'
        },
        updates: {
          type: 'object',
          description: 'Updates to apply in batch operations. Only used with applyToPrevious or filter. Leave empty if not doing batch updates.',
          additionalProperties: true
        },
        applyToPrevious: {
          type: 'string',
          description: 'Session variable name for batch operations'
        },
        batchOptions: batchOptionsSchema
      },
      required: ['operation']
    }
  },
  {
    name: 'lm_website',
    description: 'Manage LogicMonitor websites. Supports list, get, create, update, and delete operations with batch support.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: operationEnum,
        id: {
          type: 'number',
          description: 'Website ID. Can be omitted if referencing last operation.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. See resource health://logicmonitor/fields/website'
        },
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string. Examples: "name:*checkout*", "groupId:12"'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          minimum: 0
        },
        // Create/Update
        name: {
          type: 'string',
          description: 'Website name'
        },
        domain: {
          type: 'string',
          description: 'Website domain (create)'
        },
        type: {
          type: 'string',
          enum: ['webcheck', 'pingcheck'],
          description: 'Website check type (create)'
        },
        groupId: {
          type: 'number',
          description: 'Website group ID (create)'
        },
        description: {
          type: 'string'
        },
        disableAlerting: {
          type: 'boolean'
        },
        stopMonitoring: {
          type: 'boolean'
        },
        pollingInterval: {
          type: 'number'
        },
        properties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            }
          }
        },
        // Batch
        websites: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of websites for batch operations'
        },
        updates: {
          type: 'object',
          description: 'Updates to apply in batch operations. Only used with applyToPrevious or filter. Leave empty if not doing batch updates.',
          additionalProperties: true
        },
        applyToPrevious: {
          type: 'string'
        },
        batchOptions: batchOptionsSchema
      },
      required: ['operation']
    }
  },
  {
    name: 'lm_website_group',
    description: 'Manage LogicMonitor website groups. Supports list, get, create, update, and delete operations.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: operationEnum,
        id: {
          type: 'number',
          description: 'Website group ID. Can be omitted if referencing last operation.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. See resource health://logicmonitor/fields/website_group'
        },
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          minimum: 0
        },
        // Create/Update
        name: {
          type: 'string'
        },
        parentId: {
          type: 'number',
          description: 'Parent group ID (create)'
        },
        description: {
          type: 'string'
        },
        disableAlerting: {
          type: 'boolean'
        },
        stopMonitoring: {
          type: 'boolean'
        },
        properties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            }
          }
        },
        // Delete
        deleteChildren: {
          type: 'boolean'
        },
        // Batch
        groups: {
          type: 'array',
          items: { type: 'object' }
        },
        updates: {
          type: 'object',
          description: 'Updates to apply in batch operations. Only used with applyToPrevious or filter. Leave empty if not doing batch updates.',
          additionalProperties: true
        },
        applyToPrevious: {
          type: 'string'
        },
        batchOptions: batchOptionsSchema
      },
      required: ['operation']
    }
  },
  {
    name: 'lm_collector',
    description: 'List LogicMonitor collectors. Currently supports list operation only.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['list'],
          description: 'Only list operation is supported'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. See resource health://logicmonitor/fields/collector'
        },
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string. Examples: "status:active", "collectorGroupId:3"'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          minimum: 0
        }
      },
      required: ['operation']
    }
  },
  {
    name: 'lm_alert',
    description: 'Manage LogicMonitor alerts. Supports list, get, and update (ack/note/escalate) operations. Alerts cannot be created or deleted via API.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['list', 'get', 'update'],
          description: 'Alert operations: list, get, or update (for ack/note/escalate)'
        },
        id: {
          type: ['string', 'number'],
          description: 'Alert ID. Can be omitted if referencing last operation.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. See resource health://logicmonitor/fields/alert'
        },
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string. Examples: "severity>2", "cleared:false". Note: filtering only available for specific fields (id, type, acked, rule, chain, severity, cleared, sdted, startEpoch, monitorObjectName, monitorObjectGroups, resourceTemplateName, instanceName, dataPointName)'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          minimum: 0
        },
        sort: {
          type: 'string',
          description: 'Sort by property with + (asc) or - (desc). Example: "-startEpoch"'
        },
        needMessage: {
          type: 'boolean',
          description: 'Include detailed alert messages'
        },
        customColumns: {
          type: 'string',
          description: 'Property or token values to include'
        },
        // Update operations
        action: {
          type: 'string',
          enum: ['ack', 'note', 'escalate'],
          description: 'Action to perform (required for update operation)'
        },
        ackComment: {
          type: 'string',
          description: 'Comment for ack action'
        },
        note: {
          type: 'string',
          description: 'Note content for note action'
        }
      },
      required: ['operation']
    }
  },
  {
    name: 'lm_user',
    description: 'Manage LogicMonitor users. Supports list, get, create, update, and delete operations. Batch operations support explicit arrays, applyToPrevious references, and filter-based operations.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: operationEnum,
        // Common parameters
        id: {
          type: 'number',
          description: 'User ID (for get, update, delete). Can be omitted if referencing last operation.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. Use "*" for all fields.'
        },
        // List operation
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string for list or batch operations. Examples: "username:admin*", "status:active"'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          description: 'Results per page for list operation'
        },
        offset: {
          type: 'number',
          minimum: 0,
          description: 'Pagination offset for list operation'
        },
        // Create operation
        username: {
          type: 'string',
          description: 'Username (create, required)'
        },
        email: {
          type: 'string',
          description: 'Email address (create, required)'
        },
        firstName: {
          type: 'string',
          description: 'First name (create, required)'
        },
        lastName: {
          type: 'string',
          description: 'Last name (create, required)'
        },
        roles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' }
            }
          },
          description: 'Array of role objects with id (create, required)'
        },
        password: {
          type: 'string',
          description: 'Password (create, optional)'
        },
        phone: {
          type: 'string',
          description: 'Phone number (create/update)'
        },
        apionly: {
          type: 'boolean',
          description: 'API-only user flag (create/update)'
        },
        forcePasswordChange: {
          type: 'boolean',
          description: 'Force password change on next login (create/update)'
        },
        note: {
          type: 'string',
          description: 'User note (create/update)'
        },
        status: {
          type: 'string',
          description: 'User status (update)'
        },
        // Batch operations
        users: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of users for batch create/update/delete'
        },
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of user IDs for batch delete'
        },
        updates: {
          type: 'object',
          description: 'Updates to apply in batch update operations. Only used with applyToPrevious or filter. Leave empty if not doing batch updates.',
          additionalProperties: true
        },
        applyToPrevious: {
          type: 'string',
          description: 'Reference to previous operation result (e.g., "lastUserList") for batch operations'
        },
        batchOptions: batchOptionsSchema
      },
      required: ['operation']
    }
  },
  {
    name: 'lm_dashboard',
    description: 'Manage LogicMonitor dashboards. Supports list, get, create, update, and delete operations. Batch operations support explicit arrays, applyToPrevious references, and filter-based operations.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: operationEnum,
        // Common parameters
        id: {
          type: 'number',
          description: 'Dashboard ID (for get, update, delete). Can be omitted if referencing last operation.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. Use "*" for all fields.'
        },
        // List operation
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string for list or batch operations. Examples: "name:*prod*", "owner:admin"'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          description: 'Results per page for list operation'
        },
        offset: {
          type: 'number',
          minimum: 0,
          description: 'Pagination offset for list operation'
        },
        // Create operation
        name: {
          type: 'string',
          description: 'Dashboard name (create, required)'
        },
        groupId: {
          type: 'number',
          description: 'Dashboard group ID (create, required)'
        },
        description: {
          type: 'string',
          description: 'Dashboard description (create/update)'
        },
        widgetsConfig: {
          type: 'string',
          description: 'Widgets configuration JSON string (create/update)'
        },
        widgetTokens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            }
          },
          description: 'Widget tokens (create/update)'
        },
        template: {
          type: 'boolean',
          description: 'Whether dashboard is a template (create/update)'
        },
        sharable: {
          type: 'boolean',
          description: 'Whether dashboard is sharable (create/update)'
        },
        // Batch operations
        dashboards: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of dashboards for batch create/update/delete'
        },
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of dashboard IDs for batch delete'
        },
        updates: {
          type: 'object',
          description: 'Updates to apply in batch update operations. Only used with applyToPrevious or filter. Leave empty if not doing batch updates.',
          additionalProperties: true
        },
        applyToPrevious: {
          type: 'string',
          description: 'Reference to previous operation result (e.g., "lastDashboardList") for batch operations'
        },
        batchOptions: batchOptionsSchema
      },
      required: ['operation']
    }
  },
  {
    name: 'lm_collector_group',
    description: 'Manage LogicMonitor collector groups. Supports list, get, create, update, and delete operations. Batch operations support explicit arrays, applyToPrevious references, and filter-based operations.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: operationEnum,
        // Common parameters
        id: {
          type: 'number',
          description: 'Collector group ID (for get, update, delete). Can be omitted if referencing last operation.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. Use "*" for all fields.'
        },
        // List operation
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string for list or batch operations. Examples: "name:*prod*", "autoBalance:true"'
        },
        size: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          description: 'Results per page for list operation'
        },
        offset: {
          type: 'number',
          minimum: 0,
          description: 'Pagination offset for list operation'
        },
        // Create operation
        name: {
          type: 'string',
          description: 'Collector group name (create, required)'
        },
        description: {
          type: 'string',
          description: 'Collector group description (create, required)'
        },
        autoBalance: {
          type: 'boolean',
          description: 'Enable auto-balance (create/update)'
        },
        autoBalanceInstanceCountThreshold: {
          type: 'number',
          description: 'Auto-balance threshold (create/update)'
        },
        customProperties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            }
          },
          description: 'Custom properties (create/update)'
        },
        // Batch operations
        groups: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of collector groups for batch create/update/delete'
        },
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of collector group IDs for batch delete'
        },
        updates: {
          type: 'object',
          description: 'Updates to apply in batch update operations. Only used with applyToPrevious or filter. Leave empty if not doing batch updates.',
          additionalProperties: true
        },
        applyToPrevious: {
          type: 'string',
          description: 'Reference to previous operation result (e.g., "lastCollectorGroupList") for batch operations'
        },
        batchOptions: batchOptionsSchema
      },
      required: ['operation']
    }
  }
];

