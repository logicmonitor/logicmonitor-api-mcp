import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  TextContent,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import { APP_DESCRIPTION, APP_NAME, APP_VERSION } from './appInfo.js';
import { LogicMonitorClient } from './api/client.js';
import { LogicMonitorApiError } from './api/errors.js';
import { deviceTools, handleDeviceTool } from './tools/devices.js';
import { deviceGroupTools, handleDeviceGroupTool } from './tools/deviceGroups.js';
import { collectorTools, handleCollectorTool } from './tools/collectors.js';
import { alertTools, listAlerts, getAlert, ackAlert, addAlertNote, escalateAlert } from './tools/alerts.js';
import { websiteTools, handleWebsiteTool } from './tools/websites.js';
import { websiteGroupTools, handleWebsiteGroupTool } from './tools/websiteGroups.js';
import { sessionTools, handleSessionTool } from './tools/session.js';
import { SessionManager, SessionContext } from './session/sessionManager.js';
import { metricsManager } from './metrics/metricsManager.js';
import { getKnownFields, ResourceKey } from './utils/fieldMetadata.js';

export interface ServerConfig {
  name?: string;
  version?: string;
  logger?: winston.Logger;
  credentials?: {
    lm_account?: string;
    lm_bearer_token?: string;
  };
  instructions?: string;
  sessionManager?: SessionManager;
}

export async function createServer(config: ServerConfig = {}) {
  const logger = config.logger || winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });

  const instructions = config.instructions || [
    APP_DESCRIPTION || 'Use the LogicMonitor tools to manage resources, devices, collectors, and alerts.',
    'Authenticate with LM_ACCOUNT / LM_BEARER_TOKEN environment variables (stdio) or X-LM-* headers (HTTP).',
    'Every tool returns the raw LogicMonitor API payload plus request metadata. Use the metadata to chain follow-up actions safely.',
    'Before setting `fields` or `filter`, call resources/read on health://logicmonitor/fields/<resource> (device, device_group, website, website_group, collector, alert) to confirm supported field names. Unknown fields are rejected.',
    'Filters must use only those field names. Example filters are included in each field metadata resource.',
    'Session helpers (lm_*_session_*) let you store variables, review history, and manage context between tool calls.'
  ].join('\n');

  const sessionManager = config.sessionManager ?? new SessionManager();

  const mcpServer = new McpServer(
    {
      name: config.name || APP_NAME,
      version: config.version || APP_VERSION
    },
    {
      instructions
    }
  );

  mcpServer.resource(
    'logicmonitor-health-status',
    'health://logicmonitor/status',
    async () => {
      const snapshot = metricsManager.getSnapshot();
      return {
        contents: [
          {
            uri: 'health://logicmonitor/status',
            mimeType: 'application/json',
            text: JSON.stringify({ metrics: snapshot }, null, 2)
          }
        ]
      };
    }
  );

  const fieldResourceMap: Array<{ key: ResourceKey; resource: string; uri: string; description: string; filterExamples: string[] }> = [
    {
      key: 'device',
      resource: 'device',
      uri: 'health://logicmonitor/fields/device',
      description: 'Valid fields for lm_list_devices / lm_get_device.',
      filterExamples: ['displayName:"*prod*"', 'hostStatus:"alive"', 'preferredCollectorId:12']
    },
    {
      key: 'deviceGroup',
      resource: 'device_group',
      uri: 'health://logicmonitor/fields/device_group',
      description: 'Valid fields for device group tools.',
      filterExamples: ['name:"*servers*"', 'parentId:1']
    },
    {
      key: 'website',
      resource: 'website',
      uri: 'health://logicmonitor/fields/website',
      description: 'Valid fields for website tools.',
      filterExamples: ['name:"*checkout*"', 'groupId:12']
    },
    {
      key: 'websiteGroup',
      resource: 'website_group',
      uri: 'health://logicmonitor/fields/website_group',
      description: 'Valid fields for website group tools.',
      filterExamples: ['name:"*public*"', 'parentId:5']
    },
    {
      key: 'collector',
      resource: 'collector',
      uri: 'health://logicmonitor/fields/collector',
      description: 'Valid fields for lm_list_collectors.',
      filterExamples: ['status:"active"', 'collectorGroupId:3']
    },
    {
      key: 'alert',
      resource: 'alert',
      uri: 'health://logicmonitor/fields/alert',
      description: 'Valid fields for alert tools.',
      filterExamples: ['severity>:2', 'resourceId:123']
    }
  ];

  for (const mapping of fieldResourceMap) {
    mcpServer.resource(
      `logicmonitor-${mapping.resource}-fields`,
      mapping.uri,
      async () => {
        const fields = Array.from(getKnownFields(mapping.key)).sort();
        return {
          contents: [
            {
              uri: mapping.uri,
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  resource: mapping.resource,
                  description: mapping.description,
                  usage: 'Use these field names in both the `fields` parameter and filter expressions. Unknown names will be rejected.',
                  filterExamples: mapping.filterExamples,
                  fields
                },
                null,
                2
              )
            }
          ]
        };
      }
    );
  }

  mcpServer.server.registerCapabilities({
    resources: {},
    tools: {}
  });

  mcpServer.server.oninitialized = () => {
    logger.info('MCP session initialized');
  };

  mcpServer.server.onerror = (error) => {
    logger.error('MCP server error', { error: error.message, stack: error.stack });
  };

  (mcpServer as any).sessionManager = sessionManager;

  const summarizeResultForMetrics = (result: unknown): Record<string, unknown> | undefined => {
    if (!result || typeof result !== 'object') {
      return undefined;
    }

    const candidate = result as Record<string, unknown>;
    const metadata: Record<string, unknown> = {};

    if (typeof candidate.total === 'number') {
      metadata.total = candidate.total;
    }

    if (candidate.summary) {
      metadata.summary = candidate.summary;
    }

    if (candidate.meta) {
      metadata.meta = candidate.meta;
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  };


  const allTools = [
    ...deviceTools,
    ...deviceGroupTools,
    ...collectorTools,
    ...alertTools,
    ...websiteTools,
    ...websiteGroupTools,
    ...sessionTools
  ];

  mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools
  }));

  mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const sessionId = extra?.sessionId;
    const sessionContext = sessionManager.getContext(sessionId);

    logger.info('Tool call received', { tool: name, args, sessionId });

    try {
      const isSessionTool = sessionTools.some(tool => tool.name === name);
      const credentials = config.credentials || {};
      let client: LogicMonitorClient | undefined;

      if (!isSessionTool) {
        const { lm_account, lm_bearer_token } = credentials;
        if (!lm_account || !lm_bearer_token) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
          );
        }
        client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
      }

      let result: any;

      if (isSessionTool) {
        result = await handleSessionTool(name, args, sessionManager, sessionId);
      } else if (name.startsWith('lm_') && name.includes('device_group')) {
        result = await handleDeviceGroupTool(name, args, client!, sessionContext);
      } else if (name.startsWith('lm_') && name.includes('website_group')) {
        result = await handleWebsiteGroupTool(name, args, client!, sessionContext);
      } else if (name.startsWith('lm_') && name.includes('collector')) {
        result = await handleCollectorTool(name, args, client!, sessionContext);
      } else if (name.startsWith('lm_') && name.includes('alert')) {
        result = await handleAlertTool(name, args, client!, sessionContext);
      } else if (name.startsWith('lm_') && name.includes('website')) {
        result = await handleWebsiteTool(name, args, client!, sessionContext);
      } else if (name.startsWith('lm_') && name.includes('device')) {
        result = await handleDeviceTool(name, args, client!, sessionContext);
      } else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }

      sessionManager.recordResult(sessionId, name, args, result);
      metricsManager.recordSuccess(name, summarizeResultForMetrics(result));
      logger.info('Tool call successful', { tool: name, sessionId });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          } as TextContent
        ]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Tool call failed', {
        tool: name,
        error: message
      });

      const failureMetadata: Record<string, unknown> = {
        sessionId,
        args
      };

      if (error instanceof LogicMonitorApiError) {
        failureMetadata.status = error.status;
        failureMetadata.code = error.code;
        failureMetadata.requestId = error.requestId;
        failureMetadata.requestUrl = error.requestUrl;
      }

      metricsManager.recordFailure(name, error as Error, failureMetadata);

      if (error instanceof McpError) {
        throw error;
      }

      if (error instanceof LogicMonitorApiError) {
        const apiMessage = `LogicMonitor API error${error.status ? ` (status ${error.status})` : ''}${error.code ? ` [${error.code}]` : ''}: ${error.message}`;
        throw new McpError(
          ErrorCode.InternalError,
          apiMessage
        );
      }

      throw new McpError(
        ErrorCode.InternalError,
        message || 'An unknown error occurred'
      );
    }
  });

  async function handleAlertTool(name: string, args: any, client: LogicMonitorClient, sessionContext: SessionContext): Promise<any> {
    switch (name) {
      case 'lm_list_alerts':
        {
          const alertList = await listAlerts(client, args);
          sessionContext.variables.lastAlertList = alertList.items ?? [];
          sessionContext.variables.lastAlertQuery = alertList.request ?? args;
          return alertList;
        }
      case 'lm_get_alert':
        {
          const alert = await getAlert(client, args);
          sessionContext.variables.lastAlert = alert;
          sessionContext.variables.lastAlertId = args?.alertId;
          return alert;
        }
      case 'lm_ack_alert':
        return ackAlert(client, args);
      case 'lm_add_alert_note':
        return addAlertNote(client, args);
      case 'lm_escalate_alert':
        return escalateAlert(client, args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown alert tool: ${name}`
        );
    }
  }

  return mcpServer;
}
