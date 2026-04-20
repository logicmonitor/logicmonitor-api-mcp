/**
 * Session Zod validation schemas
 * Migrated from Joi schemas in sessionSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// List operation schema (get history) — .strict() rejects unknown parameters
export const SessionListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  limit: z.number().min(1).max(50).optional().describe('Maximum number of history entries to return (default 10, max 50)')
}).strict();

// Get operation schema (get context or variable) — .strict() rejects unknown parameters
export const SessionGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  key: z.string().min(1).optional().describe('Session variable name to retrieve, e.g. "lastDeviceListIds". Omit to get full session context.'),
  fields: z.string().optional().describe('For array variables: comma-separated fields to return per item, e.g. "id,displayName,hostStatus". Returns all fields if omitted.'),
  index: z.number().min(0).optional().describe('For array variables: return only the item at this index (0-based).'),
  limit: z.number().min(1).max(1000).optional().describe('For array variables: return only the first N items. Defaults to all.'),
  historyLimit: z.number().min(1).max(50).optional().describe('Maximum number of history entries to include in context (default 10, max 50)'),
  includeResults: z.boolean().optional().describe('If true, include full API response data in history entries')
}).strict();

// Create operation schema (set new variable) — .strict() rejects unknown parameters
export const SessionCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  key: z.string().min(1).describe('Session variable name to create, e.g. "myDeviceIds"'),
  value: z.any().refine(val => val !== undefined, {
    message: 'value is required'
  }).describe('Value to store in the session variable (any JSON-serializable type)')
}).strict();

// Update operation schema (update variable) — .strict() rejects unknown parameters
export const SessionUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  key: z.string().min(1).describe('Session variable name to update'),
  value: z.any().refine(val => val !== undefined, {
    message: 'value is required'
  }).describe('New value to store in the session variable (any JSON-serializable type)')
}).strict();

// Delete operation schema (clear context) — .strict() rejects unknown parameters
export const SessionDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  scope: z.enum(['variables', 'history', 'results', 'all']).optional().describe('What to clear: "variables" (stored vars), "history" (operation log), "results" (cached responses), or "all" (everything)')
}).strict();

// Combined operation schema with discriminated union
export const SessionOperationArgsSchema = z.discriminatedUnion('operation', [
  SessionListArgsSchema,
  SessionGetArgsSchema,
  SessionCreateArgsSchema,
  SessionUpdateArgsSchema,
  SessionDeleteArgsSchema
]);

// Type exports
export type SessionListArgs = z.infer<typeof SessionListArgsSchema>;
export type SessionGetArgs = z.infer<typeof SessionGetArgsSchema>;
export type SessionCreateArgs = z.infer<typeof SessionCreateArgsSchema>;
export type SessionUpdateArgs = z.infer<typeof SessionUpdateArgsSchema>;
export type SessionDeleteArgs = z.infer<typeof SessionDeleteArgsSchema>;
export type SessionOperationArgs = z.infer<typeof SessionOperationArgsSchema>;

// Validation helper function
export function validateSessionOperation(args: unknown): SessionOperationArgs {
  const result = SessionOperationArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}
