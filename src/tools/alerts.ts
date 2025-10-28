import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../api/client.js';
import type { LMAlert } from '../types/logicmonitor.js';
import {
  listAlertsSchema,
  getAlertSchema,
  ackAlertSchema,
  addAlertNoteSchema,
  escalateAlertSchema
} from '../utils/validation.js';
import { sanitizeFields } from '../utils/fieldMetadata.js';

// Tool handlers
export async function listAlerts(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = listAlertsSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);

  const fieldConfig = sanitizeFields('alert', validated.fields);

  if (fieldConfig.invalid.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Unknown alert field(s): ${fieldConfig.invalid.join(', ')}`
    );
  }

  const result = await client.listAlerts({
    filter: validated.filter,
    fields: fieldConfig.fieldsParam,
    size: validated.size || 50,
    offset: validated.offset || 0,
    sort: validated.sort,
    needMessage: validated.needMessage,
    customColumns: validated.customColumns
  });

  return {
    total: result.total,
    items: result.items as LMAlert[],
    request: {
      filter: validated.filter,
      fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(','),
      offset: validated.offset ?? 0,
      size: validated.size ?? result.items.length,
      sort: validated.sort,
      needMessage: validated.needMessage,
      customColumns: validated.customColumns
    },
    meta: result.meta,
    raw: result.raw
  };
}

export async function getAlert(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = getAlertSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);
  const alertResult = await client.getAlert(validated.alertId);
  return {
    alert: alertResult.data as LMAlert,
    meta: alertResult.meta,
    raw: alertResult.raw
  };
}

export async function ackAlert(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = ackAlertSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);
  const ackResult = await client.ackAlert(validated.alertId, validated.ackComment);
  return {
    success: true,
    alertId: validated.alertId,
    meta: ackResult.meta,
    raw: ackResult.raw
  };
}

export async function addAlertNote(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = addAlertNoteSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);
  const noteResult = await client.addAlertNote(validated.alertId, validated.ackComment);
  return {
    success: true,
    alertId: validated.alertId,
    meta: noteResult.meta,
    raw: noteResult.raw
  };
}

export async function escalateAlert(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = escalateAlertSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);
  const escalateResult = await client.escalateAlert(validated.alertId);
  return {
    success: true,
    alertId: validated.alertId,
    meta: escalateResult.meta,
    raw: escalateResult.raw
  };
}

// Export tools configuration
export const alertTools = [
  {
    name: 'lm_list_alerts',
    description: 'List LogicMonitor alerts with filtering and pagination. Automatically fetches all pages.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'LogicMonitor filter string. Note that filtering is only available for id, type, acked, rule, chain, severity, cleared, sdted, startEpoch, monitorObjectName, monitorObjectGroups, resourceTemplateName, instanceName, and dataPointName. Example: "severity>2,cleared:false". Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include). All epoch fields are in seconds since epoch. Only field names listed in health://logicmonitor/fields/alert are accepted.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. Use "*" for all fields or omit to return curated fields. See resource health://logicmonitor/fields/alert for the complete list.'
        },
        size: {
          type: 'number',
          description: 'Number of results per page (1-1000)',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          description: 'Number of results to skip',
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
          description: 'Property or token values to include. URL encode # as %23'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'lm_get_alert',
    description: 'Get a specific LogicMonitor alert by ID',
    inputSchema: {
      type: 'object',
      properties: {
        alertId: {
          type: 'string',
          description: 'The ID of the alert to retrieve'
        }
      },
      required: ['alertId'],
      additionalProperties: false
    }
  },
  {
    name: 'lm_ack_alert',
    description: 'Acknowledge a LogicMonitor alert',
    inputSchema: {
      type: 'object',
      properties: {
        alertId: {
          type: 'string',
          description: 'The ID of the alert to acknowledge'
        },
        ackComment: {
          type: 'string',
          description: 'Comment for the acknowledgment'
        }
      },
      required: ['alertId', 'ackComment'],
      additionalProperties: false
    }
  },
  {
    name: 'lm_add_alert_note',
    description: 'Add a note to a LogicMonitor alert',
    inputSchema: {
      type: 'object',
      properties: {
        alertId: {
          type: 'string',
          description: 'The ID of the alert to add a note to'
        },
        ackComment: {
          type: 'string',
          description: 'The note content to add'
        }
      },
      required: ['alertId', 'ackComment'],
      additionalProperties: false
    }
  },
  {
    name: 'lm_escalate_alert',
    description: 'Escalate a LogicMonitor alert to the next recipient in the escalation chain',
    inputSchema: {
      type: 'object',
      properties: {
        alertId: {
          type: 'string',
          description: 'The ID of the alert to escalate'
        }
      },
      required: ['alertId'],
      additionalProperties: false
    }
  }
];
