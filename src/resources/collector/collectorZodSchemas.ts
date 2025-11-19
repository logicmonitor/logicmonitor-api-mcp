/**
 * Collector Zod validation schemas
 * Migrated from Joi schemas in collectorSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@socotra/modelcontextprotocol-sdk/types.js';

// List operation schema - matches Joi validation exactly
export const CollectorListArgsSchema = z.object({
  operation: z.literal('list'),
  filter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional()
}).strict();

// Collector only supports list operation (read-only)
export const CollectorOperationArgsSchema = CollectorListArgsSchema;

// Type exports
export type CollectorListArgs = z.infer<typeof CollectorListArgsSchema>;
export type CollectorOperationArgs = z.infer<typeof CollectorOperationArgsSchema>;

// Validation helper function that matches the Joi API
export function validateListCollectors(args: unknown) {
  const result = CollectorListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

