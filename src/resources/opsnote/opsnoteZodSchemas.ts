/**
 * OpsNote Zod validation schemas
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional().describe('Max parallel API requests (default 5)'),
  continueOnError: z.boolean().optional().describe('If true, continue processing remaining items when one fails'),
  dryRun: z.boolean().optional().describe('If true, validate inputs without executing the operation')
}).optional();

const scopeSchema = z.object({
  type: z.string().describe('Scope type: device, service (website), deviceGroup, or serviceGroup (websiteGroup). Notes with no scope appear for everything in the account.')
}).loose();

const tagSchema = z.object({
  id: z.string().optional().describe('Existing tag ID (use to reference an existing tag)'),
  name: z.string().optional().describe('Tag name (use to create a new tag or reference by name)')
}).loose();

// Single opsnote create schema
const singleOpsnoteSchema = z.object({
  note: z.string().describe('The note message (required)'),
  scopes: z.array(scopeSchema).optional().describe('Scopes to associate the note with specific resources. Scope types: device, service, deviceGroup, serviceGroup. Omit for account-wide notes.'),
  tags: z.array(tagSchema).optional().describe('Tags for categorization, e.g. [{name: "deployment"}, {name: "maintenance"}]'),
  happenOnInSec: z.number().optional().describe('Timestamp for the note in epoch seconds. Defaults to current time if omitted.')
}).loose();

// List operation schema
export const OpsnoteListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().optional().describe('LM filter expression. Filterable fields: tags, createdBy, happenedOn, monitorObjectGroups, monitorObjectNames, or _all. See health://logicmonitor/fields/opsnote for valid field names.'),
  size: z.number().min(1).max(1000).optional().describe('Items per page (default 50, max 1000)'),
  offset: z.number().min(0).optional().describe('Number of items to skip for pagination (default 0)'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,note,createdBy"'),
  autoPaginate: z.boolean().optional().describe('When true, automatically fetches all pages. Use cautiously on large result sets.')
}).strict();

// Get operation schema
export const OpsnoteGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.string().optional().describe('OpsNote ID'),
  fields: z.string().optional().describe('Comma-separated list of fields to return')
}).strict();

// Create operation schema
export const OpsnoteCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  note: z.string().optional().describe('The note message (required when opsnotes is not provided)'),
  scopes: z.array(scopeSchema).optional().describe('Scopes to associate the note with specific resources. Scope types: device, service, deviceGroup, serviceGroup. Omit for account-wide notes.'),
  tags: z.array(tagSchema).optional().describe('Tags for categorization, e.g. [{name: "deployment"}, {name: "maintenance"}]'),
  happenOnInSec: z.number().optional().describe('Timestamp for the note in epoch seconds. Defaults to current time if omitted.'),
  opsnotes: z.array(singleOpsnoteSchema).min(1).optional().describe('Array of opsnote definitions for batch creation.'),
  batchOptions: batchOptionsSchema.describe('Options for controlling batch operation behavior.')
}).loose()
.superRefine((data, ctx) => {
  if (!data.opsnotes && !data.note) {
    ctx.addIssue({
      code: 'custom',
      message: 'note is required when opsnotes is not provided',
      path: ['note']
    });
  }
});

// Update operation schema
export const OpsnoteUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.string().optional().describe('OpsNote ID'),
  note: z.string().optional().describe('Updated note message'),
  scopes: z.array(scopeSchema).optional().describe('Updated scopes'),
  tags: z.array(tagSchema).optional().describe('Updated tags'),
  happenOnInSec: z.number().optional().describe('Updated timestamp in epoch seconds'),
  opsnotes: z.array(z.object({ id: z.string().optional().describe('OpsNote ID') }).passthrough()).min(1).optional().describe('Array of opsnote references for batch update. Each must include id.'),
  updates: z.record(z.string(), z.unknown()).optional().describe('Key-value map of fields to update across all targeted opsnotes.'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list, e.g. "lastOpsnoteListIds". Use lm_session list to see available variables.'),
  filter: z.string().optional().describe('LM filter expression to select opsnotes for batch update.'),
  batchOptions: batchOptionsSchema.describe('Options for controlling batch operation behavior.')
}).loose();

// Delete operation schema
export const OpsnoteDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.string().optional().describe('OpsNote ID'),
  ids: z.array(z.string()).optional().describe('Array of OpsNote IDs to delete in batch.'),
  opsnotes: z.array(z.object({ id: z.string().optional().describe('OpsNote ID') }).passthrough()).min(1).optional().describe('Array of opsnote references for batch deletion. Each must include id.'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list.'),
  filter: z.string().optional().describe('LM filter expression to select opsnotes for batch deletion.'),
  batchOptions: batchOptionsSchema.describe('Options for controlling batch operation behavior.')
}).strict();

// Combined operation schema
export const OpsnoteOperationArgsSchema = z.discriminatedUnion('operation', [
  OpsnoteListArgsSchema,
  OpsnoteGetArgsSchema,
  OpsnoteCreateArgsSchema,
  OpsnoteUpdateArgsSchema,
  OpsnoteDeleteArgsSchema
]);

// Type exports
export type OpsnoteListArgs = z.infer<typeof OpsnoteListArgsSchema>;
export type OpsnoteGetArgs = z.infer<typeof OpsnoteGetArgsSchema>;
export type OpsnoteCreateArgs = z.infer<typeof OpsnoteCreateArgsSchema>;
export type OpsnoteUpdateArgs = z.infer<typeof OpsnoteUpdateArgsSchema>;
export type OpsnoteDeleteArgs = z.infer<typeof OpsnoteDeleteArgsSchema>;
export type OpsnoteOperationArgs = z.infer<typeof OpsnoteOperationArgsSchema>;

// Validation helper functions
function formatError(error: z.ZodError) {
  return error.issues.map(e => `${String(e.path.join('.'))}: ${e.message}`).join(', ');
}

export function validateListOpsnotes(args: unknown) {
  const result = OpsnoteListArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}

export function validateGetOpsnote(args: unknown) {
  const result = OpsnoteGetArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}

export function validateCreateOpsnote(args: unknown) {
  const result = OpsnoteCreateArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}

export function validateUpdateOpsnote(args: unknown) {
  const result = OpsnoteUpdateArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}

export function validateDeleteOpsnote(args: unknown) {
  const result = OpsnoteDeleteArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}
