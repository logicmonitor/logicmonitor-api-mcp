/**
 * Website Group Zod validation schemas
 * Migrated from Joi schemas in websiteGroupSchemas.ts
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
  maxConcurrent: z.number().min(1).max(50).describe('Max parallel API requests (default 5)').optional(),
  continueOnError: z.boolean().describe('If true, continue processing remaining items when one fails').optional(),
  dryRun: z.boolean().describe('If true, validate inputs without executing the operation').optional()
}).describe('Options for controlling batch execution behavior').optional();

// Single group create schema — .loose() allows additional LM API fields not explicitly listed
const singleGroupSchema = z.object({
  name: z.string().describe('Name of the website group'),
  parentId: z.number().describe('ID of the parent group to create this group under'),
  description: z.string().describe('Description of the website group').optional(),
  disableAlerting: z.boolean().describe('If true, suppress alerts for all websites in this group').optional(),
  stopMonitoring: z.boolean().describe('If true, pause monitoring for all websites in this group').optional(),
  properties: z.array(propertySchema).describe('Properties (key-value pairs) for this group').optional()
}).loose();

// List operation schema — .strict() rejects unknown parameters
export const WebsiteGroupListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/website_group for valid field names.').optional(),
  size: z.number().min(1).max(1000).describe('Items per page (default 50, max 1000)').optional(),
  offset: z.number().min(0).describe('Number of items to skip for pagination (default 0)').optional(),
  fields: z.string().describe('Comma-separated list of fields to return, e.g. "id,displayName"').optional(),
  autoPaginate: z.boolean().describe('When true, automatically fetches all pages. Use cautiously on large result sets.').optional()
}).strict();

// Get operation schema — .strict() rejects unknown parameters
export const WebsiteGroupGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Website group ID (preferred). Alias: groupId').optional(),
  groupId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  fields: z.string().describe('Comma-separated list of fields to return, e.g. "id,displayName"').optional()
}).strict();

// Create operation schema — .loose() allows additional LM API fields not explicitly listed
export const WebsiteGroupCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  name: z.string().describe('Name of the website group. Required for single create.').optional(),
  parentId: z.number().describe('ID of the parent group. Required for single create.').optional(),
  description: z.string().describe('Description of the website group').optional(),
  disableAlerting: z.boolean().describe('If true, suppress alerts for all websites in this group').optional(),
  stopMonitoring: z.boolean().describe('If true, pause monitoring for all websites in this group').optional(),
  properties: z.array(propertySchema).describe('Properties (key-value pairs) for this group').optional(),
  groups: z.array(singleGroupSchema).min(1).describe('Array of website group objects for batch create. Mutually exclusive with name/parentId.').optional(),
  batchOptions: batchOptionsSchema
}).loose()
.superRefine((data, ctx) => {
  // If not using groups array, require single group fields
  if (!data.groups) {
    if (!data.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'name is required when groups is not provided',
        path: ['name']
      });
    }
    if (!data.parentId) {
      ctx.addIssue({
        code: 'custom',
        message: 'parentId is required when groups is not provided',
        path: ['parentId']
      });
    }
  }
});

// Update operation schema — .loose() allows additional LM API fields not explicitly listed
export const WebsiteGroupUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Website group ID to update (preferred). Alias: groupId').optional(),
  groupId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  name: z.string().describe('New name for the website group').optional(),
  description: z.string().describe('New description for the website group').optional(),
  disableAlerting: z.boolean().describe('If true, suppress alerts for all websites in this group').optional(),
  stopMonitoring: z.boolean().describe('If true, pause monitoring for all websites in this group').optional(),
  properties: z.array(propertySchema).describe('Properties to set on this group').optional(),
  groups: z.array(z.object({
    id: z.number().describe('Website group ID (preferred). Alias: groupId').optional(),
    groupId: z.number().describe('Alias for id. Prefer using id instead.').optional()
  }).passthrough()).min(1).describe('Array of website group objects for batch update, each with its own id and fields to change').optional(),
  updates: z.record(z.string(), z.unknown()).describe('Key-value map of fields to update, applied to the target group(s)').optional(),
  applyToPrevious: z.string().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.').optional(),
  filter: z.string().describe('Apply this update to all website groups matching the LM filter expression').optional(),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema — .strict() rejects unknown parameters
export const WebsiteGroupDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Website group ID to delete (preferred). Alias: groupId').optional(),
  groupId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  deleteChildren: z.boolean().describe('If true, recursively delete all child groups and their websites').optional(),
  groups: z.array(z.object({
    id: z.number().describe('Website group ID (preferred). Alias: groupId').optional(),
    groupId: z.number().describe('Alias for id. Prefer using id instead.').optional()
  }).passthrough()).min(1).describe('Array of website group objects with IDs for batch delete').optional(),
  applyToPrevious: z.string().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.').optional(),
  filter: z.string().describe('Delete all website groups matching this LM filter expression').optional(),
  batchOptions: batchOptionsSchema
}).strict();

// Combined operation schema with discriminated union
export const WebsiteGroupOperationArgsSchema = z.discriminatedUnion('operation', [
  WebsiteGroupListArgsSchema,
  WebsiteGroupGetArgsSchema,
  WebsiteGroupCreateArgsSchema,
  WebsiteGroupUpdateArgsSchema,
  WebsiteGroupDeleteArgsSchema
]);

// Type exports
export type WebsiteGroupListArgs = z.infer<typeof WebsiteGroupListArgsSchema>;
export type WebsiteGroupGetArgs = z.infer<typeof WebsiteGroupGetArgsSchema>;
export type WebsiteGroupCreateArgs = z.infer<typeof WebsiteGroupCreateArgsSchema>;
export type WebsiteGroupUpdateArgs = z.infer<typeof WebsiteGroupUpdateArgsSchema>;
export type WebsiteGroupDeleteArgs = z.infer<typeof WebsiteGroupDeleteArgsSchema>;
export type WebsiteGroupOperationArgs = z.infer<typeof WebsiteGroupOperationArgsSchema>;

// Validation helper functions
export function validateListWebsiteGroups(args: unknown) {
  const result = WebsiteGroupListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetWebsiteGroup(args: unknown) {
  const result = WebsiteGroupGetArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateCreateWebsiteGroup(args: unknown) {
  const result = WebsiteGroupCreateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateUpdateWebsiteGroup(args: unknown) {
  const result = WebsiteGroupUpdateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateDeleteWebsiteGroup(args: unknown) {
  const result = WebsiteGroupDeleteArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}
