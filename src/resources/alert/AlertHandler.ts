/**
 * Alert Resource Handler
 */

import { McpError, ErrorCode } from '@socotra/modelcontextprotocol-sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
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
import { validateAlertOperation } from './alertZodSchemas.js';

export class AlertHandler extends ResourceHandler<LMAlert> {
  constructor(client: LogicMonitorClient, sessionManager: SessionManager, sessionId?: string) {
    super(
      { resourceType: 'alert', resourceName: 'alert', idField: 'id' },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMAlert>> {
    const validated = validateAlertOperation({ ...args, operation: 'list' as const });
    const { fields, filter, size, offset, autoPaginate, sort, needMessage, customColumns } = validated;
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
      autoPaginate,
      sort,
      needMessage,
      customColumns
    });

    const result: OperationResult<LMAlert> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as unknown as LMAlert[],
      request: {
        filter,
        size,
        offset,
        sort,
        needMessage,
        customColumns,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.storeInSession('list', result);
    this.sessionManager.recordOperation(this.sessionContext.id, 'alert', 'list', result);

    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMAlert>> {
    const validated = validateAlertOperation({ ...args, operation: 'get' as const });
    const alertId = validated.id ?? validated.alertId;
    
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
    this.sessionManager.cacheResource(this.sessionContext.id, 'alert', String(alertId), apiResult.data);

    return result;
  }

  protected async handleCreate(_args: CreateOperationArgs): Promise<OperationResult<LMAlert>> {
    throw new McpError(ErrorCode.InvalidRequest, 'Alert creation is not supported via API');
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMAlert>> {
    const validated = validateAlertOperation({ ...args, operation: 'update' as const });
    const action = validated.action;
    
    if (!action) {
      throw new McpError(ErrorCode.InvalidParams, 'action is required for update operation');
    }
    
    const alertId = validated.id ?? validated.alertId;
    if (!alertId) {
      throw new McpError(ErrorCode.InvalidParams, 'Alert ID is required');
    }

    let apiResult;
    switch (action) {
      case 'ack':
        if (!validated.ackComment) {
          throw new McpError(ErrorCode.InvalidParams, 'ackComment is required for ack action');
        }
        apiResult = await this.client.ackAlert(String(alertId), validated.ackComment);
        break;
      case 'note':
        if (!validated.note) {
          throw new McpError(ErrorCode.InvalidParams, 'note is required for note action');
        }
        apiResult = await this.client.addAlertNote(String(alertId), validated.note);
        break;
      case 'escalate':
        apiResult = await this.client.escalateAlert(String(alertId));
        break;
      default:
        throw new McpError(ErrorCode.InvalidParams, `Unknown alert action: ${action}`);
    }

    const result: OperationResult<LMAlert> = {
      success: true,
      data: { alertId, action } as unknown as LMAlert,
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
