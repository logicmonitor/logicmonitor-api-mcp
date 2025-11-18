export type SessionScope = 'variables' | 'history' | 'results' | 'all';

export type ResourceType = 'device' | 'deviceGroup' | 'website' | 'websiteGroup' | 'collector' | 'alert' | 'user' | 'dashboard' | 'collectorGroup';
export type OperationType = 'list' | 'get' | 'create' | 'update' | 'delete';

export interface SessionHistoryEntry {
  timestamp: string;
  tool: string;
  arguments: unknown;
  summary: string;
}

export interface ResourceOperation {
  type: ResourceType;
  operation: OperationType;
  result: unknown;
  timestamp: string;
}

export interface SessionContext {
  id: string;
  variables: Record<string, unknown>;
  lastResults: Record<string, unknown>;
  history: SessionHistoryEntry[];
  lastOperation?: ResourceOperation;
  resourceCache: Map<ResourceType, Map<number | string, unknown>>;
}

const DEFAULT_SESSION_ID = 'default';
const MAX_HISTORY_ENTRIES = 50;

function createEmptyContext(id: string): SessionContext {
  return {
    id,
    variables: {},
    lastResults: {},
    history: [],
    lastOperation: undefined,
    resourceCache: new Map()
  };
}

function describeResult(result: unknown): string {
  if (result === null) {
    return 'null result';
  }
  if (typeof result === 'undefined') {
    return 'undefined result';
  }
  if (Array.isArray(result)) {
    return `array (${result.length} items)`;
  }
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.total === 'number') {
      parts.push(`total=${obj.total}`);
    }
    if (Array.isArray(obj.items)) {
      parts.push(`items=${obj.items.length}`);
    }
    if (typeof obj.id !== 'undefined') {
      parts.push(`id=${String(obj.id)}`);
    }
    if (parts.length === 0) {
      parts.push('object result');
    }
    return parts.join(', ');
  }
  return `${typeof result} result`;
}

export class SessionManager {
  private readonly contexts = new Map<string, SessionContext>();

  getContext(sessionId?: string): SessionContext {
    const id = sessionId ?? DEFAULT_SESSION_ID;
    let context = this.contexts.get(id);
    if (!context) {
      context = createEmptyContext(id);
      this.contexts.set(id, context);
    }
    return context;
  }

  setVariable(sessionId: string | undefined, key: string, value: unknown): SessionContext {
    const context = this.getContext(sessionId);
    context.variables[key] = value;
    return context;
  }

  getVariable(sessionId: string | undefined, key: string): { value: unknown; exists: boolean; context: SessionContext } {
    const context = this.getContext(sessionId);
    return {
      value: context.variables[key],
      exists: Object.prototype.hasOwnProperty.call(context.variables, key),
      context
    };
  }

  clear(sessionId: string | undefined, scope: SessionScope = 'all'): SessionContext {
    const context = this.getContext(sessionId);
    if (scope === 'variables' || scope === 'all') {
      context.variables = {};
    }
    if (scope === 'results' || scope === 'all') {
      context.lastResults = {};
    }
    if (scope === 'history' || scope === 'all') {
      context.history = [];
    }
    return context;
  }

  deleteContext(sessionId?: string): void {
    const id = sessionId ?? DEFAULT_SESSION_ID;
    this.contexts.delete(id);
  }

  recordResult(sessionId: string | undefined, tool: string, args: unknown, result: unknown): SessionContext {
    const context = this.getContext(sessionId);

    context.lastResults[tool] = result;
    const entry: SessionHistoryEntry = {
      timestamp: new Date().toISOString(),
      tool,
      arguments: args,
      summary: describeResult(result)
    };
    context.history.unshift(entry);
    if (context.history.length > MAX_HISTORY_ENTRIES) {
      context.history.length = MAX_HISTORY_ENTRIES;
    }
    return context;
  }

  getSnapshot(sessionId: string | undefined, options?: { historyLimit?: number; includeResults?: boolean }) {
    const context = this.getContext(sessionId);
    const historyLimit = options?.historyLimit ?? 10;
    const history = context.history.slice(0, historyLimit);

    return {
      sessionId: context.id,
      variables: { ...context.variables },
      lastResults: options?.includeResults ? { ...context.lastResults } : Object.keys(context.lastResults),
      history,
      lastOperation: context.lastOperation
    };
  }

  /**
   * Record a resource operation in session context
   */
  recordOperation(
    sessionId: string | undefined,
    resourceType: ResourceType,
    operation: OperationType,
    result: unknown
  ): void {
    const context = this.getContext(sessionId);
    context.lastOperation = {
      type: resourceType,
      operation,
      result,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cache a resource in session context
   */
  cacheResource(
    sessionId: string | undefined,
    resourceType: ResourceType,
    id: number | string,
    resource: unknown
  ): void {
    const context = this.getContext(sessionId);
    if (!context.resourceCache.has(resourceType)) {
      context.resourceCache.set(resourceType, new Map());
    }
    const cache = context.resourceCache.get(resourceType);
    if (!cache) {
      throw new Error(`Failed to get resource cache for type: ${resourceType}`);
    }
    cache.set(id, resource);
  }

  /**
   * Get cached resource
   */
  getCachedResource(
    sessionId: string | undefined,
    resourceType: ResourceType,
    id: number | string
  ): unknown | undefined {
    const context = this.getContext(sessionId);
    return context.resourceCache.get(resourceType)?.get(id);
  }

  /**
   * Resolve resource ID from session context
   * Supports automatic ID resolution from last operations
   */
  resolveResourceId(
    sessionId: string | undefined,
    resourceType: ResourceType,
    idField: string = 'id'
  ): number | string | undefined {
    const context = this.getContext(sessionId);

    // Check last operation for this resource type
    if (context.lastOperation?.type === resourceType) {
      const result = context.lastOperation.result as Record<string, unknown>;
      
      // Check if result has the ID field directly
      if (result && typeof result[idField] !== 'undefined') {
        return result[idField] as number | string;
      }

      // Check if result has a data property with the ID
      if (result?.data && typeof (result.data as Record<string, unknown>)[idField] !== 'undefined') {
        return (result.data as Record<string, unknown>)[idField] as number | string;
      }
    }

    // Check session variables for last created/retrieved resource
    const resourceName = this.getResourceName(resourceType);
    const lastCreatedKey = `lastCreated${resourceName}`;
    const lastKey = `last${resourceName}`;

    if (context.variables[lastCreatedKey]) {
      const resource = context.variables[lastCreatedKey] as Record<string, unknown>;
      if (resource && typeof resource[idField] !== 'undefined') {
        return resource[idField] as number | string;
      }
    }

    if (context.variables[lastKey]) {
      const resource = context.variables[lastKey] as Record<string, unknown>;
      if (resource && typeof resource[idField] !== 'undefined') {
        return resource[idField] as number | string;
      }
    }

    return undefined;
  }

  /**
   * Get resource name from resource type (for session variable naming)
   */
  private getResourceName(resourceType: ResourceType): string {
    const names: Record<ResourceType, string> = {
      device: 'Device',
      deviceGroup: 'DeviceGroup',
      website: 'Website',
      websiteGroup: 'WebsiteGroup',
      collector: 'Collector',
      alert: 'Alert',
      user: 'User',
      dashboard: 'Dashboard',
      collectorGroup: 'CollectorGroup'
    };
    return names[resourceType];
  }
}
