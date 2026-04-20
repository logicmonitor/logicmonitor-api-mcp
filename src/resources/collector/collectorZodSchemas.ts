/**
 * Collector Zod validation schemas
 * Migrated from Joi schemas in collectorSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// List operation schema — .strict() rejects unknown parameters
export const CollectorListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/collector for valid field names.'),
  size: z.number().min(1).max(1000).optional().describe('Items per page (default 50, max 1000)'),
  offset: z.number().min(0).optional().describe('Number of items to skip for pagination (default 0)'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"'),
  autoPaginate: z.boolean().optional().describe('When true, automatically fetches all pages. Use cautiously on large result sets.')
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
