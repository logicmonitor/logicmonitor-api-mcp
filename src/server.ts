import { McpServer } from '@socotra/modelcontextprotocol-sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  TextContent,
  ErrorCode,
  McpError
} from '@socotra/modelcontextprotocol-sdk/types.js';
import winston from 'winston';
import { APP_DESCRIPTION, APP_NAME, APP_VERSION } from './appInfo.js';
import { LogicMonitorClient } from './api/client.js';
import { LogicMonitorApiError } from './api/errors.js';
import { listPrompts, getPrompt, getPromptContent } from './tools/prompts.js';
import { SessionManager } from './session/sessionManager.js';
import { metricsManager } from './metrics/metricsManager.js';
import { getKnownFields, ResourceKey } from './utils/fieldMetadata.js';
import { DeviceHandler } from './resources/device/deviceHandler.js';
import { DeviceGroupHandler } from './resources/deviceGroup/deviceGroupHandler.js';
import { AlertHandler } from './resources/alert/alertHandler.js';
import { WebsiteHandler } from './resources/website/websiteHandler.js';
import { WebsiteGroupHandler } from './resources/websiteGroup/websiteGroupHandler.js';
import { CollectorHandler } from './resources/collector/collectorHandler.js';
import { UserHandler } from './resources/user/userHandler.js';
import { DashboardHandler } from './resources/dashboard/dashboardHandler.js';
import { CollectorGroupHandler } from './resources/collectorGroup/collectorGroupHandler.js';
import { DeviceDataHandler } from './resources/deviceData/deviceDataHandler.js';
import { SessionHandler } from './resources/session/sessionHandler.js';
import type { ResourceType } from './types/operations.js';
import { registerAlertTool } from './tools/alert/registerAlertTool.js';
import { registerCollectorTool } from './tools/collector/registerCollectorTool.js';
import { registerDeviceGroupTool } from './tools/deviceGroup/registerDeviceGroupTool.js';
import { registerDeviceTool } from './tools/device/registerDeviceTool.js';
import { registerWebsiteTool } from './tools/website/registerWebsiteTool.js';
import { registerWebsiteGroupTool } from './tools/websiteGroup/registerWebsiteGroupTool.js';
import { registerUserTool } from './tools/user/registerUserTool.js';
import { registerDashboardTool } from './tools/dashboard/registerDashboardTool.js';
import { registerCollectorGroupTool } from './tools/collectorGroup/registerCollectorGroupTool.js';
import { registerDeviceDataTool } from './tools/deviceData/registerDeviceDataTool.js';
import { registerSessionTool } from './tools/session/registerSessionTool.js';

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
    APP_DESCRIPTION || 'Use the LogicMonitor tools to manage resources, devices, collectors, alerts, users, dashboards, and more.',
    'Authenticate with LM_ACCOUNT / LM_BEARER_TOKEN environment variables (stdio) or X-LM-* headers (HTTP).',
    'Every tool returns the raw LogicMonitor API payload plus request metadata. Use the metadata to chain follow-up actions safely.',
    'Before setting `fields` or `filter`, call resources/read on health://logicmonitor/fields/<resource> (device, device_group, website, website_group, collector, collector_group, alert, user, dashboard) to confirm supported field names. Unknown fields are rejected.',
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
      instructions,
      capabilities: { resources: {}, tools: {} }
    }
  );

  mcpServer.registerResource(
    'logicmonitor-health-status',
    'health://logicmonitor/status',
    {
      title: 'LogicMonitor API Health Status',
      description: 'Real-time metrics and health status of the LogicMonitor API client',
      mimeType: 'application/json'
    },
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
      description: 'Valid fields for lm_device tool.',
      filterExamples: ['displayName:"*prod*"', 'hostStatus:"alive"', 'preferredCollectorId:12']
    },
    {
      key: 'deviceGroup',
      resource: 'device_group',
      uri: 'health://logicmonitor/fields/device_group',
      description: 'Valid fields for lm_device_group tool.',
      filterExamples: ['name:"*servers*"', 'parentId:1']
    },
    {
      key: 'website',
      resource: 'website',
      uri: 'health://logicmonitor/fields/website',
      description: 'Valid fields for lm_website tool.',
      filterExamples: ['name:"*checkout*"', 'groupId:12']
    },
    {
      key: 'websiteGroup',
      resource: 'website_group',
      uri: 'health://logicmonitor/fields/website_group',
      description: 'Valid fields for lm_website_group tool.',
      filterExamples: ['name:"*public*"', 'parentId:5']
    },
    {
      key: 'collector',
      resource: 'collector',
      uri: 'health://logicmonitor/fields/collector',
      description: 'Valid fields for lm_collector tool.',
      filterExamples: ['status:"active"', 'collectorGroupId:3']
    },
    {
      key: 'alert',
      resource: 'alert',
      uri: 'health://logicmonitor/fields/alert',
      description: 'Valid fields for lm_alert tool.',
      filterExamples: ['severity>:2', 'resourceId:123']
    },
    {
      key: 'user',
      resource: 'user',
      uri: 'health://logicmonitor/fields/user',
      description: 'Valid fields for lm_user tool.',
      filterExamples: ['username:"*admin*"', 'email:"*@example.com"', 'status:"active"']
    },
    {
      key: 'dashboard',
      resource: 'dashboard',
      uri: 'health://logicmonitor/fields/dashboard',
      description: 'Valid fields for lm_dashboard tool.',
      filterExamples: ['name:"*overview*"', 'groupId:5', 'owner:"admin"']
    },
    {
      key: 'collectorGroup',
      resource: 'collector_group',
      uri: 'health://logicmonitor/fields/collector_group',
      description: 'Valid fields for lm_collector_group tool.',
      filterExamples: ['name:"*production*"', 'autoBalance:true']
    },
    {
      key: 'deviceDatasource',
      resource: 'device_datasource',
      uri: 'health://logicmonitor/fields/device_datasource',
      description: 'Valid fields for lm_device_data list_datasources operation.',
      filterExamples: ['dataSourceName:"*CPU*"', 'stopMonitoring:false']
    },
    {
      key: 'deviceDatasourceInstance',
      resource: 'device_datasource_instance',
      uri: 'health://logicmonitor/fields/device_datasource_instance',
      description: 'Valid fields for lm_device_data list_instances operation.',
      filterExamples: ['name:"*"', 'stopMonitoring:false']
    }
  ];

  for (const mapping of fieldResourceMap) {
    mcpServer.registerResource(
      `logicmonitor-${mapping.resource}-fields`,
      mapping.uri,
      {
        title: `LogicMonitor ${mapping.resource} Fields`,
        description: `Available field names for ${mapping.resource} resources and filter expressions`,
        mimeType: 'application/json'
      },
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
              ),
              title: `LogicMonitor ${mapping.resource} fields`,
              description: mapping.description,
              name: `logicmonitor-${mapping.resource}-fields`,
              annotations: {
                audience: ["assistant"],
                priority: 1,
                lastModified: new Date().toISOString()
              }
            }
          ]
        };
      }
    );
  }

  mcpServer.server.registerCapabilities({
    resources: {},
    tools: {},
    prompts: {}
  });

  // Register alert tool using high-level API
  registerAlertTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new AlertHandler(client, sessionManager);
  });

  // Register collector tool using high-level API
  registerCollectorTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new CollectorHandler(client, sessionManager);
  });

  // Register device group tool using high-level API
  registerDeviceGroupTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new DeviceGroupHandler(client, sessionManager);
  });

  // Register device tool using high-level API
  registerDeviceTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new DeviceHandler(client, sessionManager);
  });

  // Register website tool using high-level API
  registerWebsiteTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new WebsiteHandler(client, sessionManager);
  });

  // Register website group tool using high-level API
  registerWebsiteGroupTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new WebsiteGroupHandler(client, sessionManager);
  });

  // Register user tool using high-level API
  registerUserTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new UserHandler(client, sessionManager);
  });

  // Register dashboard tool using high-level API
  registerDashboardTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new DashboardHandler(client, sessionManager);
  });

  // Register collector group tool using high-level API
  registerCollectorGroupTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new CollectorGroupHandler(client, sessionManager);
  });

  // Register device data tool using high-level API
  registerDeviceDataTool(mcpServer, () => {
    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    const client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
    return new DeviceDataHandler(client, sessionManager);
  });

  // Register session tool using high-level API
  registerSessionTool(mcpServer, () => {
    return new SessionHandler(sessionManager);
  });

  mcpServer.server.oninitialized = () => {
    logger.info('MCP session initialized');
  };

  mcpServer.server.onerror = (error) => {
    logger.error('MCP server error', { error: error.message, stack: error.stack });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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




  mcpServer.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: listPrompts()
  }));

  mcpServer.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const prompt = getPrompt(name);
    
    if (!prompt) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown prompt: ${name}`
      );
    }

    return {
      description: prompt.description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getPromptContent(name, args || {})
          }
        }
      ]
    };
  });

  mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const sessionId = extra?.sessionId;

    logger.info('Tool call received', { tool: name, args, sessionId });

    try {
      // Route to appropriate resource handler
      const resourceType = getResourceTypeFromToolName(name);
      if (!resourceType) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }

      // Session tools don't need credentials, but we still create a client for consistency
      const credentials = config.credentials || {};
      let client: LogicMonitorClient | undefined;

      if (resourceType !== 'session') {
        const { lm_account, lm_bearer_token } = credentials;
        if (!lm_account || !lm_bearer_token) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
          );
        }
        client = new LogicMonitorClient(lm_account, lm_bearer_token, logger);
      } else {
        // For session operations, create a dummy client (not used but required by handler signature)
        client = new LogicMonitorClient('dummy', 'dummy', logger);
      }

      const handler = createResourceHandler(resourceType, client, sessionManager, sessionId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler.handleOperation(args as any);

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

  /**
   * Extract resource type from tool name
   */
  function getResourceTypeFromToolName(toolName: string): ResourceType | null {
    const mapping: Record<string, ResourceType> = {
      'lm_device': 'device',
      'lm_device_group': 'deviceGroup',
      'lm_website': 'website',
      'lm_website_group': 'websiteGroup',
      'lm_collector': 'collector',
      'lm_alert': 'alert',
      'lm_user': 'user',
      'lm_dashboard': 'dashboard',
      'lm_collector_group': 'collectorGroup',
      'lm_device_data': 'deviceData',
      'lm_session': 'session'
    };
    return mapping[toolName] || null;
  }

  /**
   * Create appropriate resource handler based on resource type
   */
  function createResourceHandler(
    resourceType: ResourceType,
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    switch (resourceType) {
      case 'device':
        return new DeviceHandler(client, sessionManager, sessionId);
      case 'deviceGroup':
        return new DeviceGroupHandler(client, sessionManager, sessionId);
      case 'website':
        return new WebsiteHandler(client, sessionManager, sessionId);
      case 'websiteGroup':
        return new WebsiteGroupHandler(client, sessionManager, sessionId);
      case 'collector':
        return new CollectorHandler(client, sessionManager, sessionId);
      case 'alert':
        return new AlertHandler(client, sessionManager, sessionId);
      case 'user':
        return new UserHandler(client, sessionManager, sessionId);
      case 'dashboard':
        return new DashboardHandler(client, sessionManager, sessionId);
      case 'collectorGroup':
        return new CollectorGroupHandler(client, sessionManager, sessionId);
      case 'deviceData':
        return new DeviceDataHandler(client, sessionManager, sessionId);
      case 'session':
        return new SessionHandler(sessionManager, sessionId);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown resource type: ${resourceType}`
        );
    }
  }

  return mcpServer;
}
