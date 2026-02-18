import { Writable } from 'node:stream';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
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
import type { ResourceType, BaseOperationArgs, OperationResult } from './types/operations.js';
import { buildToolResponse } from './tools/utils/tool-response.js';
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
import type { ToolRegistration } from './tools/types.js';

export interface ServerConfig {
  name?: string;
  version?: string;
  logger?: winston.Logger;
  credentials?: {
    lm_account?: string;
    lm_bearer_token?: string;
  };
  apiTimeoutMs?: number;
  clientId?: string;
  authMode?: 'none' | 'bearer';
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
    'Follow this order every time:',
    '1) Authenticate with LM_ACCOUNT / LM_BEARER_TOKEN environment variables (stdio) or X-LM-* headers (HTTP).',
    '2) Before calling any lm_* tool, read health://logicmonitor/fields/<resource> to confirm valid field/filter names. Clients must not guess fields; unknown names are rejected.',
    '3) Before repeating a query or running create/update/delete, read health://logicmonitor/session (or call lm_session get historyLimit=5 includeResults=true) to reuse prior results and applyToPrevious handles instead of relisting.',
    '4) Tool summaries call out new session keys (for example session.lastDeviceListIds). Reuse those keys via applyToPrevious or lm_session instead of issuing duplicate list calls.',
    '5) Use lm_session create/update/delete to manage custom batches and clean up temporary context when finished.'
  ].join('\n');

  const sessionManager = config.sessionManager ?? new SessionManager();

  const mcpServer = new McpServer(
    {
      name: config.name || APP_NAME,
      version: config.version || APP_VERSION
    },
    {
      instructions,
      capabilities: { resources: {}, tools: {}, logging: {} }
    }
  );

  // Forward Winston logs as MCP logging notifications to connected clients
  const winstonToMcpLevel: Record<string, string> = {
    error: 'error',
    warn: 'warning',
    info: 'info',
    debug: 'debug'
  };

  const mcpLoggingTransport = new winston.transports.Stream({
    stream: new Writable({
      write(chunk: Buffer, _encoding: string, callback: () => void) {
        try {
          const parsed = JSON.parse(chunk.toString());
          const level = winstonToMcpLevel[parsed.level] || 'info';
          mcpServer.server.sendLoggingMessage({
            level: level as 'debug' | 'info' | 'warning' | 'error',
            logger: 'lm-api-mcp',
            data: parsed.message || parsed
          }).catch(() => { /* client may not be connected yet */ });
        } catch { /* ignore parse errors */ }
        callback();
      }
    }),
    format: winston.format.json()
  });
  logger.add(mcpLoggingTransport);

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
            text: JSON.stringify({ metrics: snapshot }, null, 2),
            annotations: {
              audience: ['assistant'],
              priority: 1,
              instructions: 'Review when troubleshooting latency or rate limits.',
              lastModified: new Date().toISOString()
            }
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
                audience: ['assistant'],
                priority: 2,
                instructions: `Read before calling lm_${mapping.resource} to validate fields and filters.`,
                lastModified: new Date().toISOString()
              }
            }
          ]
        };
      }
    );
  }

  mcpServer.registerResource(
    'logicmonitor-session',
    'health://logicmonitor/session',
    {
      title: 'LogicMonitor Session Snapshot',
      description: 'Current session variables, history, and applyToPrevious handles for this MCP session',
      mimeType: 'application/json'
    },
    async (uri, extra) => {
      const searchParams = uri.searchParams;
      const requestedLimit = Number(searchParams.get('historyLimit'));
      const historyLimit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 10;
      const includeResults = searchParams.get('includeResults') === 'true';

      const snapshot = sessionManager.getSnapshot(extra.sessionId, {
        historyLimit,
        includeResults
      });

      const variableSummaries = Object.entries(snapshot.variables).map(([key, value]) => ({
        key,
        summary: Array.isArray(value)
          ? `array(${value.length})`
          : value && typeof value === 'object'
            ? 'object'
            : typeof value
      }));

      const applyToPreviousCandidates = variableSummaries
        .filter(entry => entry.summary.startsWith('array'))
        .map(entry => {
          const countMatch = entry.summary.match(/array\((\d+)\)/);
          return {
            key: entry.key,
            length: countMatch ? Number(countMatch[1]) : undefined
          };
        });

      return {
        contents: [
          {
            uri: 'health://logicmonitor/session',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                historyLimit,
                includeResults,
                snapshot,
                variableSummaries,
                applyToPreviousCandidates
              },
              null,
              2
            ),
            title: 'LogicMonitor session context',
            description: 'Use before re-running list/update tools to reuse stored IDs',
            name: 'logicmonitor-session',
            annotations: {
              audience: ['assistant'],
              priority: 2,
              instructions: 'Read before repeating queries or running create/update/delete to reuse session variables via applyToPrevious.',
              lastModified: new Date().toISOString()
            }
          }
        ]
      };
    }
  );

  mcpServer.server.registerCapabilities({
    resources: {},
    tools: {},
    prompts: {}
  });

  // Lazily create and cache a single LogicMonitorClient for the lifetime of this server instance.
  // This preserves rate-limit tracking across calls and enables HTTP connection reuse.
  let cachedClient: LogicMonitorClient | undefined;

  function getClient(): LogicMonitorClient {
    if (cachedClient) return cachedClient;

    const credentials = config.credentials || {};
    const { lm_account, lm_bearer_token } = credentials;
    if (!lm_account || !lm_bearer_token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }
    cachedClient = new LogicMonitorClient(lm_account, lm_bearer_token, logger, {
      timeoutMs: config.apiTimeoutMs
    });
    return cachedClient;
  }

  // Tool response config per resource type for LLM-friendly summaries
  const toolResponseConfigs: Record<string, { resourceName: string; resourceTitle: string }> = {
    device: { resourceName: 'device', resourceTitle: 'LogicMonitor device' },
    deviceGroup: { resourceName: 'deviceGroup', resourceTitle: 'LogicMonitor device group' },
    website: { resourceName: 'website', resourceTitle: 'LogicMonitor website' },
    websiteGroup: { resourceName: 'websiteGroup', resourceTitle: 'LogicMonitor website group' },
    collector: { resourceName: 'collector', resourceTitle: 'LogicMonitor collector' },
    alert: { resourceName: 'alert', resourceTitle: 'LogicMonitor alert' },
    user: { resourceName: 'user', resourceTitle: 'LogicMonitor user' },
    dashboard: { resourceName: 'dashboard', resourceTitle: 'LogicMonitor dashboard' },
    collectorGroup: { resourceName: 'collectorGroup', resourceTitle: 'LogicMonitor collector group' },
    deviceData: { resourceName: 'deviceData', resourceTitle: 'LogicMonitor device data' },
    session: { resourceName: 'session', resourceTitle: 'LogicMonitor session' }
  };

  // Register tools -- callbacks are stubs because real dispatch goes through CallToolRequestSchema handler below.
  // Each register function returns ToolRegistration metadata so we can build the ListTools response
  // from our own registry instead of accessing private SDK internals.
  const stubHandler = async () => ({ content: [] as never[] });
  const registeredTools: ToolRegistration[] = [
    registerAlertTool(mcpServer, stubHandler),
    registerCollectorTool(mcpServer, stubHandler),
    registerDeviceGroupTool(mcpServer, stubHandler),
    registerDeviceTool(mcpServer, stubHandler),
    registerWebsiteTool(mcpServer, stubHandler),
    registerWebsiteGroupTool(mcpServer, stubHandler),
    registerUserTool(mcpServer, stubHandler),
    registerDashboardTool(mcpServer, stubHandler),
    registerCollectorGroupTool(mcpServer, stubHandler),
    registerDeviceDataTool(mcpServer, stubHandler),
    registerSessionTool(mcpServer, stubHandler),
  ];

  // Override the SDK's ListToolsRequestSchema handler to apply schema flattening.
  // This makes discriminated union parameters visible in the MCP Inspector.
  // Uses our local registeredTools array rather than SDK-private _registeredTools.
  const { flattenDiscriminatedUnion } = await import('./schemas/zodToJsonSchema.js');
  const { ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
  const { toJsonSchemaCompat } = await import('@modelcontextprotocol/sdk/server/zod-json-schema-compat.js');

  mcpServer.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: registeredTools.map(tool => {
      let inputSchema: Record<string, unknown> | undefined;

      if (tool.inputSchema) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jsonSchema = toJsonSchemaCompat(tool.inputSchema as any, {
          strictUnions: true,
          pipeStrategy: 'input'
        }) as Record<string, unknown>;

        inputSchema = (jsonSchema.anyOf && Array.isArray(jsonSchema.anyOf))
          ? flattenDiscriminatedUnion(jsonSchema)
          : jsonSchema;
      }

      return {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema,
        annotations: tool.annotations,
      };
    })
  }));

  mcpServer.server.oninitialized = () => {
    logger.info('MCP session initialized');
  };

  mcpServer.server.onerror = (error) => {
    logger.error('MCP server error', { error: error.message, stack: error.stack });
  };

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const progressToken = (request.params as any)._meta?.progressToken as string | number | undefined;

    logger.info('Tool call received', { tool: name, args, sessionId });

    try {
      const resourceType = getResourceTypeFromToolName(name);
      if (!resourceType) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }

      const client = resourceType !== 'session' ? getClient() : undefined;
      const handler = createResourceHandler(resourceType, client, sessionManager, sessionId);

      // Wire MCP ProgressNotifications when the client supplies a progressToken
      if (progressToken !== undefined) {
        handler.setProgressCallback((progress: number, total: number) => {
          mcpServer.server.notification({
            method: 'notifications/progress',
            params: { progressToken, progress, total }
          }).catch(() => { /* client may have disconnected */ });
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler.handleOperation(args as any);

      sessionManager.recordResult(sessionId, name, args, result);
      metricsManager.recordSuccess(name, summarizeResultForMetrics(result));
      logger.info('Tool call successful', { tool: name, sessionId });

      const responseConfig = toolResponseConfigs[resourceType] || {
        resourceName: resourceType,
        resourceTitle: `LogicMonitor ${resourceType}`
      };

      return buildToolResponse(args as BaseOperationArgs, result as OperationResult<unknown>, responseConfig);
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

      // Protocol-level errors still throw as McpError
      if (error instanceof McpError) {
        throw error;
      }

      // API and application errors return as tool content with isError flag
      // so LLM clients can see the error details and decide how to proceed
      const errorMessage = error instanceof LogicMonitorApiError
        ? `LogicMonitor API error${error.status ? ` (status ${error.status})` : ''}${error.code ? ` [${error.code}]` : ''}: ${error.message}`
        : (message || 'An unknown error occurred');

      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessage
          }
        ],
        isError: true
      };
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
    client: LogicMonitorClient | undefined,
    sessionMgr: SessionManager,
    sessionId?: string
  ) {
    if (resourceType === 'session') {
      return new SessionHandler(sessionMgr, sessionId);
    }

    if (!client) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }

    switch (resourceType) {
      case 'device':
        return new DeviceHandler(client, sessionMgr, sessionId);
      case 'deviceGroup':
        return new DeviceGroupHandler(client, sessionMgr, sessionId);
      case 'website':
        return new WebsiteHandler(client, sessionMgr, sessionId);
      case 'websiteGroup':
        return new WebsiteGroupHandler(client, sessionMgr, sessionId);
      case 'collector':
        return new CollectorHandler(client, sessionMgr, sessionId);
      case 'alert':
        return new AlertHandler(client, sessionMgr, sessionId);
      case 'user':
        return new UserHandler(client, sessionMgr, sessionId);
      case 'dashboard':
        return new DashboardHandler(client, sessionMgr, sessionId);
      case 'collectorGroup':
        return new CollectorGroupHandler(client, sessionMgr, sessionId);
      case 'deviceData':
        return new DeviceDataHandler(client, sessionMgr, sessionId);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown resource type: ${resourceType}`
        );
    }
  }

  return { server: mcpServer, sessionManager };
}
