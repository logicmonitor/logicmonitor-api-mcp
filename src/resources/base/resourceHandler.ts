/**
 * Base class for all resource handlers
 * Provides common CRUD operation routing and validation
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager, SessionContext } from '../../session/sessionManager.js';
import { capitalizeFirst } from '../../utils/strings.js';
import { batchProcessor, type BatchOptions, type BatchResult, type BatchDiagnostics } from '../../utils/batchProcessor.js';
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
   * Main entry point for handling operations
   */
  async handleOperation(args: BaseOperationArgs): Promise<OperationResult<T>> {
    const { operation } = args;

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

  protected enhanceResult(operation: OperationType, result: OperationResult<T>): void {
    void operation;
    void result;
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

