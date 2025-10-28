import { Tool } from '@modelcontextprotocol/sdk/types.js';
import Joi from 'joi';
import { SessionManager, SessionScope } from '../session/sessionManager.js';

const getContextSchema = Joi.object({
  historyLimit: Joi.number().integer().min(1).max(50).optional(),
  includeResults: Joi.boolean().optional()
}).optional();

const setVariableSchema = Joi.object({
  key: Joi.string().min(1).required(),
  value: Joi.any().required()
});

const getVariableSchema = Joi.object({
  key: Joi.string().min(1).required()
});

const clearContextSchema = Joi.object({
  scope: Joi.string().valid('variables', 'history', 'results', 'all').optional()
}).optional();

const listHistorySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional()
}).optional();

export const sessionTools: Tool[] = [
  {
    name: 'lm_get_session_context',
    description: 'Return the current session context, including stored variables, last results, and recent history. Useful for follow-up actions.',
    inputSchema: {
      type: 'object',
      properties: {
        historyLimit: {
          type: 'number',
          description: 'Maximum number of history entries to return (default: 10, max: 50)'
        },
        includeResults: {
          type: 'boolean',
          description: 'When true, include the full lastResults object instead of only the keys.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'lm_set_session_variable',
    description: 'Store an arbitrary key/value pair in the session context for use in follow-up operations.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Name of the variable to set' },
        value: {
          description: 'Value to store (any JSON-serializable data)',
          anyOf: [
            { type: 'string' },
            { type: 'number' },
            { type: 'boolean' },
            { type: 'object' },
            { type: 'array', items: {} },
            { type: 'null' }
          ]
        }
      },
      required: ['key', 'value'],
      additionalProperties: false
    }
  },
  {
    name: 'lm_get_session_variable',
    description: 'Retrieve a previously stored session variable.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Name of the variable to read' }
      },
      required: ['key'],
      additionalProperties: false
    }
  },
  {
    name: 'lm_clear_session_context',
    description: 'Clear parts of the session context (variables, results, history) or reset everything.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['variables', 'history', 'results', 'all'],
          description: 'Which part of the context to clear (default: all)'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'lm_list_session_history',
    description: 'List recent operations performed in this session, including tool names, arguments, and summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Limit the number of entries returned (default: 10, max: 50)'
        }
      },
      additionalProperties: false
    }
  }
];

export async function handleSessionTool(
  toolName: string,
  args: any,
  sessionManager: SessionManager,
  sessionId: string | undefined
): Promise<any> {
  switch (toolName) {
    case 'lm_get_session_context': {
      const validated = await getContextSchema.validateAsync(args || {});
      return sessionManager.getSnapshot(sessionId, validated);
    }
    case 'lm_set_session_variable': {
      const { key, value } = await setVariableSchema.validateAsync(args);
      const context = sessionManager.setVariable(sessionId, key, value);
      return {
        success: true,
        message: `Stored session variable '${key}'.`,
        variables: Object.keys(context.variables)
      };
    }
    case 'lm_get_session_variable': {
      const { key } = await getVariableSchema.validateAsync(args);
      const { value, exists } = sessionManager.getVariable(sessionId, key);
      if (!exists) {
        return {
          found: false,
          message: `No session variable named '${key}' was found.`
        };
      }
      return {
        found: true,
        key,
        value
      };
    }
    case 'lm_clear_session_context': {
      const { scope } = await clearContextSchema.validateAsync(args || {});
      const updatedContext = sessionManager.clear(sessionId, (scope as SessionScope) ?? 'all');
      return {
        success: true,
        cleared: scope ?? 'all',
        remainingVariables: Object.keys(updatedContext.variables),
        remainingResultKeys: Object.keys(updatedContext.lastResults),
        historyEntries: updatedContext.history.length
      };
    }
    case 'lm_list_session_history': {
      const { limit } = await listHistorySchema.validateAsync(args || {});
      const snapshot = sessionManager.getSnapshot(sessionId, {
        historyLimit: limit ?? 10,
        includeResults: false
      });
      return {
        history: snapshot.history,
        availableResultKeys: snapshot.lastResults,
        storedVariables: Object.keys(sessionManager.getContext(sessionId).variables)
      };
    }
    default:
      throw new Error(`Unknown session tool: ${toolName}`);
  }
}
