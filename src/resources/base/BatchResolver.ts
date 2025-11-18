/**
 * Batch Operation Resolver
 * Supports three patterns:
 * 1. Explicit arrays (devices: [{...}, {...}])
 * 2. Apply to previous results (applyToPrevious: "lastDeviceList")
 * 3. Filter-based batch (filter: "name:web*")
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SessionContext } from '../../session/sessionManager.js';
import { LogicMonitorClient } from '../../api/client.js';
import type { ResourceType, UpdateOperationArgs, DeleteOperationArgs, BatchOptions } from '../../types/operations.js';

export interface BatchResolutionResult<T> {
  items: T[];
  mode: 'explicit' | 'previous' | 'filter';
  source?: string;
  requiresConfirmation: boolean;
}

export class BatchOperationResolver {
  /**
   * Resolve items for batch operation from various input patterns
   */
  static async resolveItems<T>(
    args: UpdateOperationArgs | DeleteOperationArgs,
    sessionContext: SessionContext,
    client: LogicMonitorClient,
    resourceType: ResourceType,
    itemsKey: string = 'items'
  ): Promise<BatchResolutionResult<T>> {
    // Pattern 1: Explicit array
    if (args[itemsKey] && Array.isArray(args[itemsKey])) {
      return {
        items: args[itemsKey] as T[],
        mode: 'explicit',
        requiresConfirmation: false
      };
    }

    // Pattern 2: Apply to previous results
    if (args.applyToPrevious) {
      const items = this.resolveFromSession<T>(args.applyToPrevious, sessionContext);
      return {
        items,
        mode: 'previous',
        source: args.applyToPrevious,
        requiresConfirmation: false
      };
    }

    // Pattern 3: Filter-based batch
    if (args.filter) {
      const items = await this.resolveFromFilter<T>(
        args.filter,
        client,
        resourceType
      );
      
      // Filter-based operations on destructive actions require confirmation
      const isDestructive = args.operation === 'delete';
      
      return {
        items,
        mode: 'filter',
        source: args.filter,
        requiresConfirmation: isDestructive && items.length > 10
      };
    }

    throw new McpError(
      ErrorCode.InvalidParams,
      `Batch operation requires one of: ${itemsKey} array, applyToPrevious reference, or filter`
    );
  }

  /**
   * Resolve items from session context
   */
  private static resolveFromSession<T>(
    reference: string,
    sessionContext: SessionContext
  ): T[] {
    const value = sessionContext.variables[reference];

    if (!value) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Session variable '${reference}' not found. Available: ${Object.keys(sessionContext.variables).join(', ')}`
      );
    }

    if (!Array.isArray(value)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Session variable '${reference}' is not an array`
      );
    }

    if (value.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Session variable '${reference}' is empty`
      );
    }

    return value as T[];
  }

  /**
   * Resolve items by querying with filter
   */
  private static async resolveFromFilter<T>(
    filter: string,
    client: LogicMonitorClient,
    resourceType: ResourceType
  ): Promise<T[]> {
    let items: T[] = [];

    switch (resourceType) {
      case 'device': {
        const result = await client.listDevices({ filter, size: 1000 });
        items = result.items as T[];
        break;
      }
      case 'deviceGroup': {
        const result = await client.listDeviceGroups({ filter, size: 1000 });
        items = result.items as T[];
        break;
      }
      case 'website': {
        const result = await client.listWebsites({ filter, size: 1000 });
        items = result.items as T[];
        break;
      }
      case 'websiteGroup': {
        const result = await client.listWebsiteGroups({ filter, size: 1000 });
        items = result.items as T[];
        break;
      }
      case 'collector': {
        const result = await client.listCollectors({ filter, size: 1000 });
        items = result.items as T[];
        break;
      }
      case 'alert': {
        const result = await client.listAlerts({ filter, size: 1000 });
        items = result.items as T[];
        break;
      }
      case 'user': {
        const result = await client.listUsers({ filter, size: 1000 });
        items = result.items as T[];
        break;
      }
      case 'dashboard': {
        const result = await client.listDashboards({ filter, size: 1000 });
        items = result.items as T[];
        break;
      }
      case 'collectorGroup': {
        const result = await client.listCollectorGroups({ filter, size: 1000 });
        items = result.items as T[];
        break;
      }
      default:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Filter-based batch operations not supported for resource type: ${resourceType}`
        );
    }

    if (items.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `No items found matching filter: ${filter}`
      );
    }

    return items;
  }

  /**
   * Extract batch options from args
   */
  static extractBatchOptions(args: UpdateOperationArgs | DeleteOperationArgs): BatchOptions {
    return {
      maxConcurrent: args.batchOptions?.maxConcurrent ?? 5,
      continueOnError: args.batchOptions?.continueOnError ?? true,
      dryRun: args.batchOptions?.dryRun ?? false
    };
  }

  /**
   * Check if operation is a batch operation
   */
  static isBatchOperation(args: UpdateOperationArgs | DeleteOperationArgs, itemsKey: string = 'items'): boolean {
    return !!(
      (args[itemsKey] && Array.isArray(args[itemsKey]) && (args[itemsKey] as unknown[]).length > 1) ||
      args.applyToPrevious ||
      args.filter
    );
  }

  /**
   * Validate batch operation safety
   */
  static validateBatchSafety(
    resolution: BatchResolutionResult<unknown>,
    operation: 'update' | 'delete',
    maxBatchSize: number = 1000
  ): void {
    if (resolution.items.length > maxBatchSize) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Batch operation exceeds maximum size of ${maxBatchSize} items (got ${resolution.items.length})`
      );
    }

    if (resolution.requiresConfirmation) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `This ${operation} operation affects ${resolution.items.length} items. For safety, please use explicit item arrays or applyToPrevious for destructive operations on large result sets.`
      );
    }
  }
}

