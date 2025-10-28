import { LogicMonitorClient } from '../api/client.js';
import { LMAlert } from '../types/logicmonitor.js';
import {
  listAlertsSchema,
  getAlertSchema,
  ackAlertSchema,
  addAlertNoteSchema,
  escalateAlertSchema
} from '../utils/validation.js';

// Default fields to return for alert list operations when no fields are specified
const DEFAULT_ALERT_FIELDS = [
  'id', 'internalId', 'type', 'startEpoch', 'endEpoch', 'acked', 'ackedBy', 
  'ackedEpoch', 'ackComment', 'rule', 'chain', 'severity', 'cleared', 
  'sdted', 'monitorObjectName', 'monitorObjectType', 'instanceName', 
  'dataPointName', 'alertValue', 'threshold', 'resourceId',
  'resourceTemplateName', 'anomaly', 'adAlert'
];


// Tool handlers
export async function listAlerts(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = listAlertsSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);
  
  const result = await client.listAlerts({
    filter: validated.filter,
    fields: validated.fields,
    size: validated.size || 50,
    offset: validated.offset || 0,
    sort: validated.sort,
    needMessage: validated.needMessage,
    customColumns: validated.customColumns
  });

  const items = result.items ?? [];
  const reportedTotal = typeof result.total === 'number' ? result.total : items.length;
  const searchId = (result.raw as { searchId?: string } | undefined)?.searchId;

  const payload: {
    total: number;
    items: LMAlert[];
    searchId: string | undefined;
    request: {
      filter: unknown;
      fields: unknown;
      offset: number;
      size: number;
      sort: unknown;
      needMessage: unknown;
      customColumns: unknown;
    };
    curated?: Record<string, unknown>[];
  } = {
    total: reportedTotal,
    items,
    searchId,
    request: {
      filter: validated.filter,
      fields: validated.fields,
      offset: validated.offset ?? 0,
      size: validated.size ?? items.length,
      sort: validated.sort,
      needMessage: validated.needMessage,
      customColumns: validated.customColumns
    }
  };

  if (!validated.fields || validated.fields === '*') {
    payload.curated = items.map((alert: LMAlert) => {
      const curated: Record<string, unknown> = {};
      DEFAULT_ALERT_FIELDS.forEach(field => {
        if (field in alert) {
          curated[field] = (alert as any)[field];
        }
      });
      return curated;
    });
  }

  return payload;
}

export async function getAlert(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = getAlertSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);
  const alertResult = await client.getAlert(validated.alertId);
  return alertResult.data;
}

export async function ackAlert(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = ackAlertSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);
  await client.ackAlert(validated.alertId, validated.ackComment);
  return {
    success: true,
    message: `Alert ${validated.alertId} acknowledged successfully`
  };
}

export async function addAlertNote(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = addAlertNoteSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);
  await client.addAlertNote(validated.alertId, validated.ackComment);
  return {
    success: true,
    message: `Note added to alert ${validated.alertId} successfully`
  };
}

export async function escalateAlert(
  client: LogicMonitorClient,
  args: any
) {
  const { error, value: validated } = escalateAlertSchema.validate(args);
  if (error) throw new Error(`Validation error: ${error.message}`);
  await client.escalateAlert(validated.alertId);
  return {
    success: true,
    message: `Alert ${validated.alertId} escalated successfully`
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
          description: 'LogicMonitor filter string. Note that filtering is only available for id, type, acked, rule, chain, severity, cleared, sdted, startEpoch, monitorObjectName, monitorObjectGroups, resourceTemplateName, instanceName, and dataPointName. Example: "severity>2,cleared:false". Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include). All epoch fields are in seconds since epoch.'
        },
        fields: {
          type: 'string',
          description: 'Comma-separated list of fields to return. Use "*" for all fields or Omit to return curated fields. Unless otherwise specified, you should default to using all fields.'
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
