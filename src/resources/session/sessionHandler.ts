/**
 * Session Resource Handler
 * Handles session context operations (list history, get context, set/update variables, clear)
 */

import { ResourceHandler } from '../base/resourceHandler.js';
import { LogicMonitorClient } from '../../api/client.js';
import { SessionManager, SessionScope } from '../../session/sessionManager.js';
import type {
  ListOperationArgs,
  GetOperationArgs,
  CreateOperationArgs,
  UpdateOperationArgs,
  DeleteOperationArgs,
  OperationResult
} from '../../types/operations.js';
import { validateSessionOperation } from './sessionZodSchemas.js';

interface SessionData {
  sessionId?: string;
  variables?: Record<string, unknown>;
  lastResults?: Record<string, unknown> | string[];
  history?: Array<{
    timestamp: string;
    tool: string;
    arguments: unknown;
    summary: string;
  }>;
  lastOperation?: {
    type: string;
    operation: string;
    result: unknown;
    timestamp: string;
  };
  key?: string;
  value?: unknown;
  found?: boolean;
  message?: string;
  success?: boolean;
  cleared?: string;
  remainingVariables?: string[];
  remainingResultKeys?: string[];
  historyEntries?: number;
  availableResultKeys?: string[] | Record<string, unknown>;
  storedVariables?: string[];
}

export class SessionHandler extends ResourceHandler<SessionData> {
  constructor(
    sessionManager: SessionManager,
    sessionId?: string
  ) {
    // Session handler doesn't need a client - pass null as any
    super(
      {
        resourceType: 'session',
        resourceName: 'session',
        idField: 'sessionId'
      },
      // Session handler doesn't need a LogicMonitor client
      null as unknown as LogicMonitorClient,
      sessionManager,
      sessionId
    );
  }

  /**
   * List operation - Returns session history
   * Maps to old lm_list_session_history
   */
  protected async handleList(args: ListOperationArgs): Promise<OperationResult<SessionData>> {
    const validated = validateSessionOperation(args) as Extract<ReturnType<typeof validateSessionOperation>, { operation: 'list' }>;
    const { limit } = validated;

    const snapshot = this.sessionManager.getSnapshot(this.sessionContext.id, {
      historyLimit: limit ?? 10,
      includeResults: false
    });

    const result: OperationResult<SessionData> = {
      success: true,
      data: {
        history: snapshot.history,
        availableResultKeys: snapshot.lastResults,
        storedVariables: Object.keys(this.sessionContext.variables)
      },
      request: {
        limit: limit ?? 10
      }
    };

    return result;
  }

  /**
   * Get operation - Returns session context or specific variable
   * Maps to old lm_get_session_context and lm_get_session_variable
   */
  protected async handleGet(args: GetOperationArgs): Promise<OperationResult<SessionData>> {
    const validated = validateSessionOperation(args) as Extract<ReturnType<typeof validateSessionOperation>, { operation: 'get' }>;
    const { key, historyLimit, includeResults } = validated;

    // If key is provided, get specific variable
    if (key) {
      const { value, exists } = this.sessionManager.getVariable(this.sessionContext.id, key);
      
      if (!exists) {
        const result: OperationResult<SessionData> = {
          success: true,
          data: {
            found: false,
            message: `No session variable named '${key}' was found.`
          },
          request: { key }
        };
        return result;
      }

      const result: OperationResult<SessionData> = {
        success: true,
        data: {
          found: true,
          key,
          value
        },
        request: { key }
      };
      return result;
    }

    // Otherwise, return full session context
    const snapshot = this.sessionManager.getSnapshot(this.sessionContext.id, {
      historyLimit,
      includeResults
    });

    const result: OperationResult<SessionData> = {
      success: true,
      data: {
        sessionId: snapshot.sessionId,
        variables: snapshot.variables,
        lastResults: snapshot.lastResults,
        history: snapshot.history,
        lastOperation: snapshot.lastOperation
      },
      request: {
        historyLimit: historyLimit ?? 10,
        includeResults: includeResults ?? false
      }
    };

    return result;
  }

  /**
   * Create operation - Sets a new session variable
   * Maps to old lm_set_session_variable
   */
  protected async handleCreate(args: CreateOperationArgs): Promise<OperationResult<SessionData>> {
    const validated = validateSessionOperation(args) as Extract<ReturnType<typeof validateSessionOperation>, { operation: 'create' }>;
    const { key, value } = validated;

    const context = this.sessionManager.setVariable(this.sessionContext.id, key, value);

    const result: OperationResult<SessionData> = {
      success: true,
      data: {
        success: true,
        message: `Stored session variable '${key}'.`,
        storedVariables: Object.keys(context.variables)
      },
      request: {
        key,
        value
      }
    };

    return result;
  }

  /**
   * Update operation - Updates an existing session variable
   * Maps to old lm_set_session_variable (same behavior as create)
   */
  protected async handleUpdate(args: UpdateOperationArgs): Promise<OperationResult<SessionData>> {
    const validated = validateSessionOperation(args) as Extract<ReturnType<typeof validateSessionOperation>, { operation: 'update' }>;
    const { key, value } = validated;

    const context = this.sessionManager.setVariable(this.sessionContext.id, key, value);

    const result: OperationResult<SessionData> = {
      success: true,
      data: {
        success: true,
        message: `Updated session variable '${key}'.`,
        storedVariables: Object.keys(context.variables)
      },
      request: {
        key,
        value
      }
    };

    return result;
  }

  /**
   * Delete operation - Clears session context
   * Maps to old lm_clear_session_context
   */
  protected async handleDelete(args: DeleteOperationArgs): Promise<OperationResult<SessionData>> {
    const validated = validateSessionOperation(args) as Extract<ReturnType<typeof validateSessionOperation>, { operation: 'delete' }>;
    const { scope } = validated;

    const updatedContext = this.sessionManager.clear(
      this.sessionContext.id,
      (scope as SessionScope) ?? 'all'
    );

    const result: OperationResult<SessionData> = {
      success: true,
      data: {
        success: true,
        cleared: scope ?? 'all',
        remainingVariables: Object.keys(updatedContext.variables),
        remainingResultKeys: Object.keys(updatedContext.lastResults),
        historyEntries: updatedContext.history.length
      },
      request: {
        scope: scope ?? 'all'
      }
    };

    return result;
  }
}

