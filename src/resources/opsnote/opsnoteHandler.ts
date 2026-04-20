/**
 * OpsNote Resource Handler
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../base/resourceHandler.js';
import { BatchOperationResolver } from '../base/batchResolver.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager } from '../../session/sessionManager.js';
import { throwBatchFailure } from '../../utils/batchUtils.js';
import type { LMOpsNote } from '../../types/logicmonitor.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import type { BatchResult } from '../../utils/batchProcessor.js';
import {
  validateListOpsnotes,
  validateGetOpsnote,
  validateCreateOpsnote,
  validateUpdateOpsnote,
  validateDeleteOpsnote
} from './opsnoteZodSchemas.js';

export class OpsnoteHandler extends ResourceHandler<LMOpsNote> {
  constructor(
    client: LogicMonitorClient,
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    super(
      {
        resourceType: 'opsnote',
        resourceName: 'opsnote',
        idField: 'id',
        pluralKey: 'opsnotes'
      },
      client,
      sessionManager,
      sessionId
    );
  }

  protected async handleList(args: ListOperationArgs): Promise<OperationResult<LMOpsNote>> {
    const validated = validateListOpsnotes(args);
    const { fields, filter, size, offset, autoPaginate } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.listOpsNotes({
      fields: fieldConfig.fieldsParam,
      filter,
      size,
      offset,
      autoPaginate
    });

    const result: OperationResult<LMOpsNote> = {
      success: true,
      total: apiResult.total,
      items: apiResult.items as LMOpsNote[],
      request: {
        filter,
        size,
        offset,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('list', result);
    return result;
  }

  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<LMOpsNote>> {
    const validated = validateGetOpsnote(args);
    const noteId = validated.id ?? this.resolveId(validated);

    if (typeof noteId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'OpsNote ID must be a string');
    }

    const { fields } = validated;
    const fieldConfig = this.validateFields(fields);

    const apiResult = await this.client.getOpsNote(noteId, {
      fields: fieldConfig.fieldsParam
    });

    const result: OperationResult<LMOpsNote> = {
      success: true,
      data: apiResult.data,
      request: {
        noteId,
        fields: fieldConfig.includeAll ? undefined : fieldConfig.applied.join(',')
      },
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('get', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'opsnote', noteId, apiResult.data);
    return result;
  }

  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<LMOpsNote>> {
    const validated = validateCreateOpsnote(args);
    const isBatch = this.isBatchCreate(validated);
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);
    const notesInput = this.normalizeCreateInput(validated);

    const batchResult = await this.processBatch(
      notesInput,
      async (notePayload) => this.client.createOpsNote(notePayload),
      {
        maxConcurrent: batchOptions.maxConcurrent || 5,
        continueOnError: batchOptions.continueOnError ?? true,
        retryOnRateLimit: true
      }
    );

    const normalized = this.normalizeBatchResults(batchResult);

    if (!isBatch) {
      const entry = normalized[0];
      if (!entry || !entry.success || !entry.data) {
        throwBatchFailure('OpsNote create', batchResult.results[0]);
      }
      const createdNote = entry.data as LMOpsNote;

      const result: OperationResult<LMOpsNote> = {
        success: true,
        data: createdNote,
        raw: entry.raw ?? createdNote,
        meta: entry.meta ?? undefined
      };

      this.recordAndStore('create', result);
      this.sessionManager.cacheResource(this.sessionContext.id, 'opsnote', createdNote.id, createdNote);
      return result;
    }

    const successfulNotes = this.extractSuccessfulItems(normalized);

    const result: OperationResult<LMOpsNote> = {
      success: batchResult.success,
      items: successfulNotes,
      summary: batchResult.summary,
      request: {
        batch: true,
        batchOptions,
        opsnotes: notesInput
      },
      results: normalized
    };

    this.recordAndStore('create', result);
    return result;
  }

  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<LMOpsNote>> {
    const validated = validateUpdateOpsnote(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'opsnotes');
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
        validated,
        this.sessionContext,
        this.client,
        'opsnote',
        'opsnotes'
      );

      BatchOperationResolver.validateBatchSafety(resolution, 'update');

      const updates = validated.updates || {};
      const batchResult = await this.processBatch(
        resolution.items,
        async (note: Record<string, unknown>) => {
          const noteId = note.id;
          if (!noteId || typeof noteId !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'OpsNote ID is required for update');
          }
          const mergedUpdates = { ...note, ...updates };
          delete mergedUpdates.id;
          return this.client.updateOpsNote(noteId, mergedUpdates);
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult);
      const successfulNotes = this.extractSuccessfulItems(normalized);

      const result: OperationResult<LMOpsNote> = {
        success: batchResult.success,
        items: successfulNotes,
        summary: batchResult.summary,
        request: {
          batch: true,
          mode: resolution.mode,
          source: resolution.source,
          batchOptions
        },
        results: normalized
      };

      this.recordAndStore('update', result);
      return result;
    }

    const noteId = validated.id ?? this.resolveId(validated);
    if (typeof noteId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'OpsNote ID must be a string');
    }

    const updates: Record<string, unknown> = { ...validated };
    delete updates.operation;
    delete updates.portal;
    delete updates.id;

    const apiResult = await this.client.updateOpsNote(noteId, updates);
    const result: OperationResult<LMOpsNote> = {
      success: true,
      data: apiResult.data,
      meta: apiResult.meta,
      raw: apiResult.raw
    };

    this.recordAndStore('update', result);
    this.sessionManager.cacheResource(this.sessionContext.id, 'opsnote', noteId, apiResult.data);
    return result;
  }

  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<LMOpsNote>> {
    const validated = validateDeleteOpsnote(args);
    const isBatch = BatchOperationResolver.isBatchOperation(validated, 'opsnotes') ||
                     (validated.ids && Array.isArray(validated.ids));
    const batchOptions = BatchOperationResolver.extractBatchOptions(validated);

    if (isBatch) {
      let itemsToDelete: Array<Record<string, unknown>>;

      if (validated.ids && Array.isArray(validated.ids)) {
        itemsToDelete = validated.ids.map((id) => ({ id }));
      } else {
        const resolution = await BatchOperationResolver.resolveItems<Record<string, unknown>>(
          validated,
          this.sessionContext,
          this.client,
          'opsnote',
          'opsnotes'
        );
        BatchOperationResolver.validateBatchSafety(resolution, 'delete');
        itemsToDelete = resolution.items;
      }

      const batchResult = await this.processBatch(
        itemsToDelete,
        async (note: Record<string, unknown>) => {
          const noteId = note.id;
          if (!noteId || typeof noteId !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'OpsNote ID is required for delete');
          }
          await this.client.deleteOpsNote(noteId);
          return { id: noteId } as unknown as LMOpsNote;
        },
        {
          maxConcurrent: batchOptions.maxConcurrent || 5,
          continueOnError: batchOptions.continueOnError ?? true,
          retryOnRateLimit: true
        }
      );

      const normalized = this.normalizeBatchResults(batchResult as BatchResult<LMOpsNote>);

      const result: OperationResult<LMOpsNote> = {
        success: batchResult.success,
        summary: batchResult.summary,
        request: {
          batch: true,
          batchOptions
        },
        results: normalized
      };

      this.recordAndStore('delete', result);
      return result;
    }

    const noteId = validated.id ?? this.resolveId(validated);
    if (typeof noteId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'OpsNote ID must be a string');
    }

    await this.client.deleteOpsNote(noteId);
    const result: OperationResult<LMOpsNote> = {
      success: true,
      data: undefined
    };

    this.recordAndStore('delete', result);
    return result;
  }
}
