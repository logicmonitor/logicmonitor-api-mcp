/**
 * Session Zod validation schemas
 * Migrated from Joi schemas in sessionSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@socotra/modelcontextprotocol-sdk/types.js';

// List operation schema (get history)
export const SessionListArgsSchema = z.object({
  operation: z.literal('list'),
  limit: z.number().min(1).max(50).optional()
}).strict();

// Get operation schema (get context or variable)
export const SessionGetArgsSchema = z.object({
  operation: z.literal('get'),
  key: z.string().min(1).optional(),
  historyLimit: z.number().min(1).max(50).optional(),
  includeResults: z.boolean().optional()
}).strict();

// Create operation schema (set new variable)
export const SessionCreateArgsSchema = z.object({
  operation: z.literal('create'),
  key: z.string().min(1),
  value: z.any().refine(val => val !== undefined, {
    message: 'value is required'
  })
}).strict();

// Update operation schema (update variable)
export const SessionUpdateArgsSchema = z.object({
  operation: z.literal('update'),
  key: z.string().min(1),
  value: z.any().refine(val => val !== undefined, {
    message: 'value is required'
  })
}).strict();

// Delete operation schema (clear context)
export const SessionDeleteArgsSchema = z.object({
  operation: z.literal('delete'),
  scope: z.enum(['variables', 'history', 'results', 'all']).optional()
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

