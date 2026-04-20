/**
 * Base class for all resource handlers
 * Provides common CRUD operation routing and validation
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager, SessionContext } from '../../session/sessionManager.js';
import { capitalizeFirst } from '../../utils/strings.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import { batchProcessor, type BatchOptions, type BatchResult, type BatchItem, type BatchDiagnostics } from '../../utils/batchProcessor.js';
import type { LogicMonitorResponseMeta } from '../../api/client.js';
import type {
  ResourceType,
  OperationType,
  BaseOperationArgs,
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';

export interface ResourceHandlerConfig {
  resourceType: ResourceType;
  resourceName: string;
  idField: string;
  /** Plural key for batch array inputs (e.g., 'devices', 'groups', 'users') */
  pluralKey?: string;
  /** Optional link builder for attaching portal URLs to results */
  linkBuilder?: (portalUiBaseUrl: string, resource: Record<string, unknown>) => string | undefined;
}

export abstract class ResourceHandler<T = unknown> {
  protected readonly config: ResourceHandlerConfig;
  private readonly _client: LogicMonitorClient | undefined;
  protected readonly sessionManager: SessionManager;
  protected readonly sessionContext: SessionContext;
  private _progressCallback?: (progress: number, total: number) => void;

  constructor(
    config: ResourceHandlerConfig,
    client: LogicMonitorClient | undefined,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    this.config = config;
    this._client = client;
    this.sessionManager = sessionManager;
    this.sessionContext = sessionManager.getContext(sessionId);
  }

  /**
   * Access the API client. Throws a clear error if no client was provided
   * (e.g. SessionHandler operates without one).
   */
  protected get client(): LogicMonitorClient {
    if (!this._client) {
      throw new McpError(
        ErrorCode.InternalError,
        `${this.config.resourceType} handler requires a LogicMonitor API client but none was provided`
      );
    }
    return this._client;
  }

  /**
   * Set an optional progress callback for MCP ProgressNotifications.
   * Called by the CallToolRequestSchema handler when the client supplies a progressToken.
   */
  setProgressCallback(callback?: (progress: number, total: number) => void): void {
    this._progressCallback = callback;
  }

  /** Expose progress callback to subclasses for direct use if needed */
  protected get progressCallback(): ((progress: number, total: number) => void) | undefined {
    return this._progressCallback;
  }

  /**
   * Wrapper around batchProcessor.processBatch that automatically wires
   * the MCP progress callback so clients receive ProgressNotifications.
   */
  protected async processBatch<TInput, TData>(
    items: TInput[],
    processor: (item: TInput, index: number) => Promise<
      TData | {
        data: TData;
        diagnostics?: BatchDiagnostics;
        meta?: LogicMonitorResponseMeta;
        raw?: unknown;
      }
    >,
    options: Omit<BatchOptions, 'onProgress'> = {}
  ): Promise<BatchResult<TData>> {
    return batchProcessor.processBatch(items, processor, {
      ...options,
      onProgress: this._progressCallback
    });
  }

  /**
   * Main entry point for handling operations.
   * Subclasses can override handleCustomOperation() to handle non-standard
   * operations (e.g. list_datasources, get_data) while still benefiting
   * from applyEnhancements for the standard CRUD path.
   */
  async handleOperation(args: BaseOperationArgs): Promise<OperationResult<T>> {
    const { operation } = args;

    // Allow subclasses to handle custom operations first
    const customResult = await this.handleCustomOperation(operation, args);
    if (customResult !== null) {
      return this.applyEnhancements(operation as OperationType, customResult);
    }

    switch (operation) {
      case 'list':
        return this.applyEnhancements('list', await this.handleList(args as ListOperationArgs));
      case 'get':
        return this.applyEnhancements('get', await this.handleGet(args as GetOperationArgs));
      case 'create':
        return this.applyEnhancements('create', await this.handleCreate(args as CreateOperationArgs));
      case 'update':
        return this.applyEnhancements('update', await this.handleUpdate(args as UpdateOperationArgs));
      case 'delete':
        return this.applyEnhancements('delete', await this.handleDelete(args as DeleteOperationArgs));
      default:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown operation: ${operation}`
        );
    }
  }

  /**
   * Override in subclasses to handle non-standard operations.
   * Return null to fall through to standard CRUD routing.
   */
  protected async handleCustomOperation(
    _operation: string,
    _args: BaseOperationArgs
  ): Promise<OperationResult<T> | null> {
    return null;
  }

  private applyEnhancements(
    operation: OperationType,
    result: OperationResult<T>
  ): OperationResult<T> {
    this.enhanceResult(operation, result);
    return result;
  }

  /**
   * Abstract methods that must be implemented by subclasses
   */
  protected abstract handleList(args: ListOperationArgs): Promise<OperationResult<T>>;
  protected abstract handleGet(args: GetOperationArgs): Promise<OperationResult<T>>;
  protected abstract handleCreate(args: CreateOperationArgs): Promise<OperationResult<T>>;
  protected abstract handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<T>>;
  protected abstract handleDelete(args: DeleteOperationArgs): Promise<OperationResult<T>>;

  protected enhanceResult(_operation: OperationType, result: OperationResult<T>): void {
    if (!this.config.linkBuilder || !this._client) return;
    const portalUiBaseUrl = this._client.getPortalUiBaseUrl();
    const attach = (item: Record<string, unknown>) => {
      try {
        const url = this.config.linkBuilder?.(portalUiBaseUrl, item);
        if (url) item.linkUrl = url;
      } catch {
        // Link generation is non-critical
      }
    };
    if (result.data) attach(result.data as unknown as Record<string, unknown>);
    if (result.items) result.items.forEach(i => attach(i as unknown as Record<string, unknown>));
  }

  /**
   * Resolve resource ID from args or session context
   */
  protected resolveId(args: GetOperationArgs | UpdateOperationArgs | DeleteOperationArgs): number | string {
    // Explicit ID provided
    if (args.id !== undefined) {
      return args.id;
    }

    // Try to resolve from session context
    const lastCreatedKey = `lastCreated${capitalizeFirst(this.config.resourceName)}`;
    const lastKey = `last${capitalizeFirst(this.config.resourceName)}`;

    // Check for last created resource
    if (this.sessionContext.variables[lastCreatedKey]) {
      const resource = this.sessionContext.variables[lastCreatedKey] as Record<string, unknown>;
      if (resource && typeof resource[this.config.idField] !== 'undefined') {
        return resource[this.config.idField] as number | string;
      }
    }

    // Check for last retrieved resource
    if (this.sessionContext.variables[lastKey]) {
      const resource = this.sessionContext.variables[lastKey] as Record<string, unknown>;
      if (resource && typeof resource[this.config.idField] !== 'undefined') {
        return resource[this.config.idField] as number | string;
      }
    }

    throw new McpError(
      ErrorCode.InvalidParams,
      `No ${this.config.resourceName} ID provided and no recent ${this.config.resourceName} found in session context. Please provide an 'id' parameter.`
    );
  }

  // ── Common helpers ──────────────────────────────────────────────────

  /**
   * Validate and sanitize field selections for this resource type.
   * Throws McpError if unknown fields are requested.
   */
  protected validateFields(fields?: string) {
    const fieldConfig = sanitizeFields(this.config.resourceType as Parameters<typeof sanitizeFields>[0], fields);
    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown ${this.config.resourceName} field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }
    return fieldConfig;
  }

  /**
   * Store result in session AND record the operation in one call.
   */
  protected recordAndStore(operation: OperationType | string, result: OperationResult<T>): void {
    this.storeInSession(operation as OperationType, result);
    this.sessionManager.recordOperation(
      this.sessionContext.id, this.config.resourceType, operation as OperationType, result
    );
  }

  /**
   * Passthrough normalization of batch results into a consistent array.
   */
  protected normalizeBatchResults(batch: BatchResult<T>): Array<BatchItem<T>> {
    return batch.results.map(entry => ({
      index: entry.index,
      success: entry.success,
      data: entry.data,
      error: entry.error,
      diagnostics: entry.diagnostics,
      meta: entry.meta,
      raw: entry.raw
    }));
  }

  /**
   * Extract the data from successful batch entries.
   */
  protected extractSuccessfulItems(results: Array<BatchItem<T>>): T[] {
    return results
      .filter((entry): entry is typeof entry & { data: T } => entry.success && entry.data !== undefined)
      .map(entry => entry.data);
  }

  /**
   * Check if the args contain a batch create array (using the configured pluralKey).
   */
  protected isBatchCreate(args: Record<string, unknown>): boolean {
    const key = this.config.pluralKey;
    return !!(key && args[key] && Array.isArray(args[key]));
  }

  /**
   * Normalize create input into an array of payloads.
   * Uses the configured pluralKey to detect batch arrays.
   */
  protected normalizeCreateInput(args: Record<string, unknown>): Array<Record<string, unknown>> {
    const key = this.config.pluralKey;
    if (key && args[key] && Array.isArray(args[key])) {
      return args[key] as Array<Record<string, unknown>>;
    }
    const single = { ...args };
    delete single.operation;
    delete single.batchOptions;
    delete single.portal;
    return [single];
  }

  /**
   * Store result in session context with appropriate keys
   */
  protected storeInSession(operation: OperationType, result: OperationResult<T>): void {
    const resourceName = capitalizeFirst(this.config.resourceName);

    switch (operation) {
      case 'list':
        if (result.items) {
          this.sessionContext.variables[`last${resourceName}List`] = result.items;
          this.sessionContext.variables[`last${resourceName}ListIds`] = result.items.map(
            item => (item as Record<string, unknown>)[this.config.idField]
          );
        }
        break;
      case 'get':
        if (result.data) {
          this.sessionContext.variables[`last${resourceName}`] = result.data;
          this.sessionContext.variables[`last${resourceName}Id`] = (result.data as Record<string, unknown>)[this.config.idField];
        }
        break;
      case 'create':
        if (result.data) {
          this.sessionContext.variables[`lastCreated${resourceName}`] = result.data;
          this.sessionContext.variables[`last${resourceName}`] = result.data;
        } else if (result.items) {
          this.sessionContext.variables[`lastCreated${resourceName}s`] = result.items;
        }
        break;
      case 'update':
        if (result.data) {
          this.sessionContext.variables[`lastUpdated${resourceName}`] = result.data;
          this.sessionContext.variables[`last${resourceName}`] = result.data;
        } else if (result.items) {
          this.sessionContext.variables[`lastUpdated${resourceName}s`] = result.items;
        }
        break;
      case 'delete':
        if (result.data && typeof (result.data as Record<string, unknown>)[this.config.idField] !== 'undefined') {
          this.sessionContext.variables[`lastDeleted${resourceName}Id`] = (result.data as Record<string, unknown>)[this.config.idField];
        }
        break;
    }
  }

}
