/**
 * Collector Resource Handler (read-only)
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import type { LMCollector } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import { validateListCollectors } from './collectorZodSchemas.js';

export class CollectorHandler extends ResourceHandler<LMCollector> {
  constructor(client: LogicMonitorClient, sessionManager: SessionManager, sessionId?: string) {
    super(
      { resourceType: 'collector', resourceName: 'collector', idField: 'id' },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMCollector>> {
    const validated = validateListCollectors(args);
    const { fields, filter, size, offset, autoPaginate } = validated;
    const fieldConfig = sanitizeFields('collector', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown collector field(s): ${fieldConfig.invalid.join(', ')}`);
    }

    const apiResult = await this.client.listCollectors({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset,
      autoPaginate
    });

    const result: OperationResult<LMCollector> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMCollector[],
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('list', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'collector', 'list', result);
    return result;
  }

  protected async handleGet(_args: GetOperationArgs): Promise<OperationResult<LMCollector>> {
    throw new McpError(ErrorCode.InvalidRequest, 'Get collector by ID not yet implemented');
  }

  protected async handleCreate(_args: CreateOperationArgs): Promise<OperationResult<LMCollector>> {
    throw new McpError(ErrorCode.InvalidRequest, 'Collector creation not supported via API');
  }

  protected async handleUpdate(_args: UpdateOperationArgs): Promise<OperationResult<LMCollector>> {
    throw new McpError(ErrorCode.InvalidRequest, 'Collector update not yet implemented');
  }

  protected async handleDelete(_args: DeleteOperationArgs): Promise<OperationResult<LMCollector>> {
    throw new McpError(ErrorCode.InvalidRequest, 'Collector deletion not supported via API');
  }
}

