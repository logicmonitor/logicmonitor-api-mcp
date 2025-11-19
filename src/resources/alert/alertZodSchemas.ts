/**
 * Alert Zod validation schemas
 * Using flat schema structure for MCP Inspector compatibility
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@socotra/modelcontextprotocol-sdk/types.js';

// Flat schema with all fields optional except operation
export const AlertOperationArgsSchema = z.object({
  // Required field
  operation: z.enum(['list', 'get', 'update']),
  
  // List operation fields
  filter: z.string().optional(),
  fields: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  autoPaginate: z.boolean().optional(),
  sort: z.string().optional(),
  needMessage: z.boolean().optional(),
  customColumns: z.string().optional(),
  
  // Get operation fields
  id: z.union([z.string(), z.number()]).optional(),
  alertId: z.union([z.string(), z.number()]).optional(),
  
  // Update operation fields
  action: z.enum(['ack', 'note', 'escalate']).optional(),
  ackComment: z.string().optional(),
  note: z.string().optional()
}).strict()
.superRefine((data, ctx) => {
  // Validate operation-specific required fields
  if (data.operation === 'update') {
    if (!data.action) {
      ctx.addIssue({
        code: 'custom',
        message: 'action is required for update operation',
        path: ['action']
      });
    }
    
    if (data.action === 'ack' && !data.ackComment) {
      ctx.addIssue({
        code: 'custom',
        message: 'ackComment is required for ack action',
        path: ['ackComment']
      });
    }
    
    if (data.action === 'note' && !data.note) {
      ctx.addIssue({
        code: 'custom',
        message: 'note is required for note action',
        path: ['note']
      });
    }
  }
});

// Type exports
export type AlertOperationArgs = z.infer<typeof AlertOperationArgsSchema>;

// Legacy type exports for backward compatibility
export type AlertListArgs = AlertOperationArgs & { operation: 'list' };
export type AlertGetArgs = AlertOperationArgs & { operation: 'get' };
export type AlertUpdateArgs = AlertOperationArgs & { operation: 'update' };

// Validation helper function
export function validateAlertOperation(args: unknown): AlertOperationArgs {
  const result = AlertOperationArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

