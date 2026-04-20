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
import { ResourceHandler } from './resources/base/resourceHandler.js';
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
import { SdtHandler } from './resources/sdt/sdtHandler.js';
import { OpsnoteHandler } from './resources/opsnote/opsnoteHandler.js';
import type { ResourceType, BaseOperationArgs, OperationResult } from './types/operations.js';
import { buildToolResponse } from './tools/utils/tool-response.js';
import { registerAllTools } from './tools/registry.js';
import type { ToolRegistration } from './tools/registry.js';
import { resolveCredentialsForOperation } from './auth/portalResolution.js';
import { type LMCredentials, type ResolvedLMCredentials, serializeCredentialsIdentity } from './auth/lmCredentials.js';
import {
  buildScopedSessionId,
  getDefaultPortal,
  getVisibleVariableKeys,
  getVisibleVariables,
  listPortalScopes,
  registerPortalScope,
} from './session/portalSessionState.js';
import { fetchAvailablePortals } from './api/sessionAuth.js';

export interface ServerConfig {
  name?: string;
  version?: string;
  logger?: winston.Logger;
  credentials?: LMCredentials;
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
    '1) Authenticate with either LM_ACCOUNT / LM_BEARER_TOKEN or LM_SESSION_LISTENER_BASE_URL (optionally LM_PORTAL as a default portal) environment variables (stdio), or the equivalent X-LM-* headers (HTTP).',
    '2) Before calling any lm_* tool, try reading health://logicmonitor/fields/<resource> to confirm valid field/filter names. If resource reads are not available in your client, refer to the tool and parameter descriptions for field guidance.',
    '3) In listener mode, pass portal="<portal>" on resource tools to target a specific portal, or set lm_session key "defaultPortal" to reduce repetition.',
    '4) Before repeating a query or running create/update/delete, read health://logicmonitor/session (or call lm_session get historyLimit=5 includeResults=true) to reuse prior results and applyToPrevious handles instead of relisting.',
    '5) lm_session get shows defaultPortal, availablePortals, and portal-scoped state when listener-based auth is active.',
    '6) Tool summaries call out new session keys (for example session.lastDeviceListIds). Reuse those keys via applyToPrevious or lm_session instead of issuing duplicate list calls.',
    '7) Use lm_session create/update/delete to manage custom batches and clean up temporary context when finished.'
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
      filterExamples: ['name:"*servers*"', 'parentId:1', 'appliesTo:""  (static groups only — empty appliesTo means devices can be manually assigned)']
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
    },
    {
      key: 'sdt',
      resource: 'sdt',
      uri: 'health://logicmonitor/fields/sdt',
      description: 'Valid fields for lm_sdt operations.',
      filterExamples: ['type:"ResourceSDT"', 'isEffective:true', 'admin:"*"']
    },
    {
      key: 'opsnote',
      resource: 'opsnote',
      uri: 'health://logicmonitor/fields/opsnote',
      description: 'Valid fields for lm_opsnote operations.',
      filterExamples: ['tags:"deployment"', 'createdBy:"admin"', '_all:"*maintenance*"']
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
      const visibleVariables = getVisibleVariables(snapshot.variables as Record<string, unknown>);

      const variableSummaries = Object.entries(visibleVariables).map(([key, value]) => ({
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

      const portalScopes = listPortalScopes(sessionManager, extra.sessionId).map((scope) => {
        const scopedContext = sessionManager.getContext(scope.sessionId);
        return {
          portal: scope.portal,
          sessionId: scope.sessionId,
          storedVariables: getVisibleVariableKeys(scopedContext.variables),
          availableResultKeys: Object.keys(scopedContext.lastResults),
          historyEntries: scopedContext.history.length,
        };
      });

      const availablePortals = config.credentials && config.credentials.kind !== 'bearer'
        ? await fetchAvailablePortals(config.credentials, config.apiTimeoutMs ?? 30000).catch(() => undefined)
        : undefined;

      return {
        contents: [
          {
            uri: 'health://logicmonitor/session',
            mimeType: 'application/json',
            text: JSON.stringify(
                {
                  historyLimit,
                  includeResults,
                  snapshot: {
                    ...snapshot,
                    variables: visibleVariables,
                  },
                  defaultPortal: getDefaultPortal(sessionManager, extra.sessionId),
                  availablePortals,
                  portalScopes,
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

  // Lazily create and cache LogicMonitor clients by resolved credential identity.
  // This preserves rate-limit tracking across calls while keeping portal-specific
  // session clients isolated from one another.
  const clientCache = new Map<string, LogicMonitorClient>();

  function getClient(credentials: ResolvedLMCredentials): LogicMonitorClient {
    const identity = serializeCredentialsIdentity(credentials);
    const cachedClient = clientCache.get(identity);
    if (cachedClient) {
      return cachedClient;
    }

    const client = new LogicMonitorClient(credentials, logger, {
      timeoutMs: config.apiTimeoutMs
    });
    clientCache.set(identity, client);
    return client;
  }

  async function resolveToolContext(
    resourceType: ResourceType,
    args: BaseOperationArgs,
    sessionId?: string
  ): Promise<{
    client?: LogicMonitorClient;
    handlerSessionId?: string;
  }> {
    if (resourceType === 'session') {
      return { handlerSessionId: sessionId };
    }

    const credentials = config.credentials;
    if (!credentials) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Configure LM_ACCOUNT/LM_BEARER_TOKEN or LM_SESSION_LISTENER_BASE_URL.'
      );
    }

    const resolved = await resolveCredentialsForOperation(credentials, {
      portal: args.portal,
      sessionDefaultPortal: getDefaultPortal(sessionManager, sessionId),
      timeoutMs: config.apiTimeoutMs ?? 30000,
    });

    let handlerSessionId = sessionId;

    if (resolved.credentials.kind === 'session') {
      const identity = serializeCredentialsIdentity(resolved.credentials);
      handlerSessionId = buildScopedSessionId(sessionId, identity);
      registerPortalScope(
        sessionManager,
        sessionId,
        resolved.credentials.lm_portal,
        handlerSessionId,
        identity
      );
    }

    return {
      client: getClient(resolved.credentials),
      handlerSessionId,
    };
  }

  // Single source of truth for all tool ↔ resource type mappings
  type HandlerConstructor = new (client: LogicMonitorClient, sm: SessionManager, sid?: string) => ResourceHandler;
  const TOOL_REGISTRY: Record<string, {
    resourceType: ResourceType;
    resourceTitle: string;
    handler: HandlerConstructor | null; // null = special case (session)
  }> = {
    'lm_device':          { resourceType: 'device',         resourceTitle: 'LogicMonitor device',          handler: DeviceHandler },
    'lm_device_group':    { resourceType: 'deviceGroup',    resourceTitle: 'LogicMonitor device group',    handler: DeviceGroupHandler },
    'lm_website':         { resourceType: 'website',        resourceTitle: 'LogicMonitor website',         handler: WebsiteHandler },
    'lm_website_group':   { resourceType: 'websiteGroup',   resourceTitle: 'LogicMonitor website group',   handler: WebsiteGroupHandler },
    'lm_collector':       { resourceType: 'collector',      resourceTitle: 'LogicMonitor collector',       handler: CollectorHandler },
    'lm_alert':           { resourceType: 'alert',          resourceTitle: 'LogicMonitor alert',           handler: AlertHandler },
    'lm_user':            { resourceType: 'user',           resourceTitle: 'LogicMonitor user',            handler: UserHandler },
    'lm_dashboard':       { resourceType: 'dashboard',      resourceTitle: 'LogicMonitor dashboard',       handler: DashboardHandler },
    'lm_collector_group': { resourceType: 'collectorGroup', resourceTitle: 'LogicMonitor collector group', handler: CollectorGroupHandler },
    'lm_device_data':     { resourceType: 'deviceData',     resourceTitle: 'LogicMonitor device data',     handler: DeviceDataHandler },
    'lm_sdt':             { resourceType: 'sdt',             resourceTitle: 'LogicMonitor SDT',             handler: SdtHandler },
    'lm_opsnote':         { resourceType: 'opsnote',         resourceTitle: 'LogicMonitor OpsNote',         handler: OpsnoteHandler },
    'lm_session':         { resourceType: 'session',        resourceTitle: 'LogicMonitor session',         handler: null },
  };

  // Register tools -- callbacks are stubs because real dispatch goes through CallToolRequestSchema handler below.
  // Each register function returns ToolRegistration metadata so we can build the ListTools response
  // from our own registry instead of accessing private SDK internals.
  const stubHandler = async () => ({ content: [] as never[] });
  const registeredTools: ToolRegistration[] = registerAllTools(mcpServer, stubHandler);

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

        const hasUnion = (jsonSchema.anyOf && Array.isArray(jsonSchema.anyOf)) ||
                         (jsonSchema.oneOf && Array.isArray(jsonSchema.oneOf));
        inputSchema = hasUnion
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

      const toolContext = await resolveToolContext(
        resourceType,
        args as BaseOperationArgs,
        sessionId
      );
      const handler = createResourceHandler(
        resourceType,
        toolContext.client,
        sessionManager,
        toolContext.handlerSessionId
      );

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

      sessionManager.recordResult(toolContext.handlerSessionId, name, args, result);
      metricsManager.recordSuccess(name, summarizeResultForMetrics(result));
      logger.info('Tool call successful', { tool: name, sessionId: toolContext.handlerSessionId });

      const registryEntry = TOOL_REGISTRY[name];
      const responseConfig = {
        resourceName: resourceType,
        resourceTitle: registryEntry?.resourceTitle ?? `LogicMonitor ${resourceType}`
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
        ? formatApiError(error)
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

  function formatApiError(error: LogicMonitorApiError): string {
    const lines: string[] = [];

    // Primary error message (already contains the API's errorMessage)
    lines.push(`LogicMonitor API error (${error.status ?? 'unknown'}): ${error.message}`);

    // Include errorDetail from the response body if present
    const body = error.responseBody as Record<string, unknown> | undefined;
    if (body?.errorDetail && typeof body.errorDetail === 'object') {
      const detail = body.errorDetail as Record<string, unknown>;
      const detailStr = Object.entries(detail)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n');
      if (detailStr) {
        lines.push('Error details:');
        lines.push(detailStr);
      }
    }

    // Lightweight status-based hints
    if (error.status === 404) lines.push('Hint: Resource not found. Verify the ID by listing resources first.');
    if (error.status === 401 || error.status === 403) lines.push('Hint: Check API token permissions.');
    if (error.status === 429) lines.push('Hint: Rate limited. The server will retry automatically.');

    return lines.join('\n');
  }

  function getResourceTypeFromToolName(toolName: string): ResourceType | null {
    return TOOL_REGISTRY[toolName]?.resourceType ?? null;
  }

  function createResourceHandler(
    resourceType: ResourceType,
    client: LogicMonitorClient | undefined,
    sessionMgr: SessionManager,
    sessionId?: string
  ) {
    if (resourceType === 'session') {
      return new SessionHandler(sessionMgr, sessionId, {
        credentials: config.credentials,
        apiTimeoutMs: config.apiTimeoutMs,
      });
    }

    if (!client) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'LogicMonitor credentials not provided. Please configure lm_account and lm_bearer_token.'
      );
    }

    const entry = Object.values(TOOL_REGISTRY).find(e => e.resourceType === resourceType);
    if (!entry?.handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown resource type: ${resourceType}`);
    }
    return new entry.handler(client, sessionMgr, sessionId);
  }

  /** Remove the MCP logging transport from the shared logger. Call on session close. */
  function cleanup() {
    logger.remove(mcpLoggingTransport);
  }

  return { server: mcpServer, sessionManager, cleanup };
}
