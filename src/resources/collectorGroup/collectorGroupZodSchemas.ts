/**
 * Collector Group Zod validation schemas
 * Migrated from Joi schemas in collectorGroupSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// Common schemas
const propertySchema = z.object({
  name: z.string().describe('Property name'),
  value: z.string().describe('Property value')
});

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional().describe('Max parallel API requests (default 5)'),
  continueOnError: z.boolean().optional().describe('If true, continue processing remaining items when one fails'),
  dryRun: z.boolean().optional().describe('If true, validate inputs without executing the operation')
}).optional();

// Single group create schema — .loose() allows additional LM API fields not explicitly listed
const singleGroupSchema = z.object({
  name: z.string().describe('Collector group name'),
  description: z.string().optional().describe('Collector group description'),
  properties: z.array(propertySchema).optional().describe('Array of custom properties as {name, value} objects'),
  autoBalance: z.boolean().optional().describe('When true, enables automatic load balancing of collectors within the group.'),
  autoBalanceInstanceCountThreshold: z.number().optional().describe('Instance count threshold that triggers auto-balancing. Only applies when autoBalance is true.')
}).loose();

// List operation schema — .strict() rejects unknown parameters
export const CollectorGroupListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/collector_group for valid field names.'),
  size: z.number().min(1).max(1000).optional().describe('Items per page (default 50, max 1000)'),
  offset: z.number().min(0).optional().describe('Number of items to skip for pagination (default 0)'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"'),
  autoPaginate: z.boolean().optional().describe('When true, automatically fetches all pages. Use cautiously on large result sets.')
}).strict();

// Get operation schema — .strict() rejects unknown parameters
export const CollectorGroupGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().optional().describe('Collector group ID (preferred). Alias: groupId'),
  groupId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"')
}).strict();

// Create operation schema — .loose() allows additional LM API fields not explicitly listed
export const CollectorGroupCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  name: z.string().optional().describe('Collector group name (required when groups is not provided)'),
  description: z.string().optional().describe('Collector group description'),
  properties: z.array(propertySchema).optional().describe('Array of custom properties as {name, value} objects'),
  customProperties: z.array(propertySchema).optional().describe('Array of custom properties as {name, value} objects (alternate key)'),
  autoBalance: z.boolean().optional().describe('When true, enables automatic load balancing of collectors within the group.'),
  autoBalanceInstanceCountThreshold: z.number().optional().describe('Instance count threshold that triggers auto-balancing. Only applies when autoBalance is true.'),
  groups: z.array(singleGroupSchema).min(1).optional().describe('Array of collector group definitions for batch creation.'),
  batchOptions: batchOptionsSchema.describe('Options for controlling batch operation behavior.')
}).loose()
.superRefine((data, ctx) => {
  // If not using groups array, require name
  if (!data.groups && !data.name) {
    ctx.addIssue({
      code: 'custom',
      message: 'name is required when groups is not provided',
      path: ['name']
    });
  }
});

// Update operation schema — .loose() allows additional LM API fields not explicitly listed
export const CollectorGroupUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().optional().describe('Collector group ID (preferred). Alias: groupId'),
  groupId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  name: z.string().optional().describe('Updated collector group name'),
  description: z.string().optional().describe('Updated collector group description'),
  properties: z.array(propertySchema).optional().describe('Array of custom properties as {name, value} objects'),
  customProperties: z.array(propertySchema).optional().describe('Array of custom properties as {name, value} objects (alternate key)'),
  autoBalance: z.boolean().optional().describe('When true, enables automatic load balancing of collectors within the group.'),
  autoBalanceInstanceCountThreshold: z.number().optional().describe('Instance count threshold that triggers auto-balancing. Only applies when autoBalance is true.'),
  groups: z.array(z.object({ id: z.number().optional().describe('Collector group ID (preferred). Alias: groupId'), groupId: z.number().optional().describe('Alias for id. Prefer using id instead.') }).passthrough()).min(1).optional().describe('Array of collector group references for batch update. Each must include id or groupId.'),
  updates: z.record(z.string(), z.unknown()).optional().describe('Key-value map of fields to update across all targeted groups.'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.'),
  filter: z.string().optional().describe('LM filter expression to select groups for batch update, e.g. "name:*prod*".'),
  batchOptions: batchOptionsSchema.describe('Options for controlling batch operation behavior.')
}).loose();

// Delete operation schema — .strict() rejects unknown parameters
export const CollectorGroupDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().optional().describe('Collector group ID (preferred). Alias: groupId'),
  groupId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  ids: z.array(z.number()).optional().describe('Array of collector group IDs to delete in batch.'),
  groups: z.array(z.object({ id: z.number().optional().describe('Collector group ID (preferred). Alias: groupId'), groupId: z.number().optional().describe('Alias for id. Prefer using id instead.') }).passthrough()).min(1).optional().describe('Array of collector group references for batch deletion. Each must include id or groupId.'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.'),
  filter: z.string().optional().describe('LM filter expression to select groups for batch deletion, e.g. "name:*test*".'),
  batchOptions: batchOptionsSchema.describe('Options for controlling batch operation behavior.')
}).strict();

// Combined operation schema with discriminated union
export const CollectorGroupOperationArgsSchema = z.discriminatedUnion('operation', [
  CollectorGroupListArgsSchema,
  CollectorGroupGetArgsSchema,
  CollectorGroupCreateArgsSchema,
  CollectorGroupUpdateArgsSchema,
  CollectorGroupDeleteArgsSchema
]);

// Type exports
export type CollectorGroupListArgs = z.infer<typeof CollectorGroupListArgsSchema>;
export type CollectorGroupGetArgs = z.infer<typeof CollectorGroupGetArgsSchema>;
export type CollectorGroupCreateArgs = z.infer<typeof CollectorGroupCreateArgsSchema>;
export type CollectorGroupUpdateArgs = z.infer<typeof CollectorGroupUpdateArgsSchema>;
export type CollectorGroupDeleteArgs = z.infer<typeof CollectorGroupDeleteArgsSchema>;
export type CollectorGroupOperationArgs = z.infer<typeof CollectorGroupOperationArgsSchema>;

// Validation helper functions
export function validateListCollectorGroups(args: unknown) {
  const result = CollectorGroupListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetCollectorGroup(args: unknown) {
  const result = CollectorGroupGetArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateCreateCollectorGroup(args: unknown) {
  const result = CollectorGroupCreateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateUpdateCollectorGroup(args: unknown) {
  const result = CollectorGroupUpdateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateDeleteCollectorGroup(args: unknown) {
  const result = CollectorGroupDeleteArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}
