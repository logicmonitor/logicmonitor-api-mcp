/**
 * Alert Resource Handler
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/ResourceHandler.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { sanitizeFields } from '../../utils/fieldMetadata.js';
import type { LMAlert } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import {
  validateListAlerts,
  validateGetAlert,
  validateUpdateAlert
} from './alertSchemas.js';

export class AlertHandler extends ResourceHandler<LMAlert> {
  constructor(
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    super(
      {
        resourceType: 'alert',
        resourceName: 'alert',
        idField: 'id'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMAlert>> {
    const validated = validateListAlerts(args);
    const { fields, filter, size, offset, sort, needMessage, customColumns } = validated;
    const fieldConfig = sanitizeFields('alert', fields);

    if (fieldConfig.invalid.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown alert field(s): ${fieldConfig.invalid.join(', ')}`
      );
    }

    const apiResult = await this.client.listAlerts({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset,
      sort,
      needMessage,
      customColumns
    });

    const result: OperationResult<LMAlert> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMAlert[],
      request: {
        filter,
        size,
        offset,
        sort,
        needMessage,
        customColumns,
        fields: fieldConfig.includeAll ? '*' : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('list', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'alert', 'list', result);

    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMAlert>> {
    const validated = validateGetAlert(args);
    const alertId = validated.id ?? this.resolveId(validated);
    
    if (!alertId) {
      throw new McpError(ErrorCode.InvalidParams, 'Alert ID is required');
    }

    const apiResult = await this.client.getAlert(String(alertId));

    const result: OperationResult<LMAlert> = {
      success: true,
      data: apiResult.data,
      request: { alertId },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('get', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'alert', 'get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'alert', alertId, apiResult.data);

    return result;
  }

  protected async handleCreate(_args: CreateOperationArgs): Promise<OperationResult<LMAlert>> {
    throw new McpError(ErrorCode.InvalidRequest, 'Alert creation is not supported via API');
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMAlert>> {
    const validated = validateUpdateAlert(args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const action = (validated as any).action;
    
    const alertId = validated.id ?? this.resolveId(validated);
    if (!alertId) {
      throw new McpError(ErrorCode.InvalidParams, 'Alert ID is required');
    }

    let apiResult;
    switch (action) {
      case 'ack':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiResult = await this.client.ackAlert(String(alertId), (validated as any).ackComment || '');
        break;
      case 'note':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiResult = await this.client.addAlertNote(String(alertId), (validated as any).note || '');
        break;
      case 'escalate':
        apiResult = await this.client.escalateAlert(String(alertId));
        break;
      default:
        throw new McpError(ErrorCode.InvalidParams, `Unknown alert action: ${action}`);
    }

    const result: OperationResult<LMAlert> = {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { alertId, action } as any,
      raw: apiResult.raw,
      meta: apiResult.meta
    };

    this.storeInSession('update', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'alert', 'update', result);

    return result;
  }

  protected async handleDelete(_args: DeleteOperationArgs): Promise<OperationResult<LMAlert>> {
    throw new McpError(ErrorCode.InvalidRequest, 'Alert deletion is not supported via API');
  }
}

