/**
 * Device Group Zod validation schemas
 * Migrated from Joi schemas in deviceGroupSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// Common schemas
const customPropertySchema = z.object({
  name: z.string().describe('Custom property name'),
  value: z.string().describe('Custom property value')
});

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).describe('Max parallel API requests (default 5)').optional(),
  continueOnError: z.boolean().describe('If true, continue processing remaining items when one fails').optional(),
  dryRun: z.boolean().describe('If true, validate inputs without executing the operation').optional()
}).describe('Options for controlling batch execution behavior').optional();

// List operation schema — .strict() rejects unknown parameters
export const DeviceGroupListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/device_group for valid field names.').optional(),
  size: z.number().min(1).max(1000).describe('Items per page (default 50, max 1000)').optional(),
  offset: z.number().min(0).describe('Number of items to skip for pagination (default 0)').optional(),
  fields: z.string().describe('Comma-separated list of fields to return, e.g. "id,displayName"').optional(),
  autoPaginate: z.boolean().describe('When true, automatically fetches all pages. Use cautiously on large result sets.').optional(),
  parentId: z.number().describe('Filter results to only groups under this parent group ID').optional()
}).strict();

// Get operation schema — .strict() rejects unknown parameters
export const DeviceGroupGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Device group ID (preferred). Alias: groupId').optional(),
  groupId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  fields: z.string().describe('Comma-separated list of fields to return, e.g. "id,displayName"').optional()
}).strict();

// Create operation schema — .loose() allows additional LM API fields not explicitly listed
const singleGroupCreateSchema = z.object({
  name: z.string().describe('Name of the device group'),
  parentId: z.number().describe('ID of the parent group to create this group under'),
  description: z.string().describe('Description of the device group').optional(),
  appliesTo: z.string().describe('AppliesTo expression for dynamic group membership, e.g. "system.displayName =~ \\"prod\\""').optional(),
  customProperties: z.array(customPropertySchema).describe('Custom properties (key-value pairs) for this group').optional()
}).loose(); // .loose() allows additional LM API fields not explicitly listed

// Create operation schema — .loose() allows additional LM API fields not explicitly listed
export const DeviceGroupCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  name: z.string().describe('Name of the device group. Required for single create.').optional(),
  parentId: z.number().describe('ID of the parent group. Required for single create.').optional(),
  description: z.string().describe('Description of the device group').optional(),
  appliesTo: z.string().describe('AppliesTo expression for dynamic group membership, e.g. "system.displayName =~ \\"prod\\""').optional(),
  customProperties: z.array(customPropertySchema).describe('Custom properties (key-value pairs) for this group').optional(),
  groups: z.array(singleGroupCreateSchema).min(1).describe('Array of device group objects for batch create. Mutually exclusive with name/parentId.').optional(),
  batchOptions: batchOptionsSchema
}).loose() // .loose() allows additional LM API fields not explicitly listed
.superRefine((data, ctx) => {
  // If groups is provided, name and parentId are optional
  // If groups is not provided, name and parentId are required
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
export const DeviceGroupUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Device group ID to update (preferred). Alias: groupId').optional(),
  groupId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  name: z.string().describe('New name for the device group').optional(),
  description: z.string().describe('New description for the device group').optional(),
  appliesTo: z.string().describe('New appliesTo expression for dynamic group membership').optional(),
  customProperties: z.array(customPropertySchema).describe('Custom properties to set on this group').optional(),
  groups: z.array(z.object({
    id: z.number().describe('Device group ID (preferred). Alias: groupId').optional(),
    groupId: z.number().describe('Alias for id. Prefer using id instead.').optional()
  }).passthrough()).min(1).describe('Array of device group objects for batch update, each with its own id and fields to change').optional(),
  updates: z.record(z.string(), z.unknown()).describe('Key-value map of fields to update, applied to the target group(s)').optional(),
  applyToPrevious: z.string().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.').optional(),
  filter: z.string().describe('Apply this update to all device groups matching the LM filter expression').optional(),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema — .strict() rejects unknown parameters
export const DeviceGroupDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Device group ID to delete (preferred). Alias: groupId').optional(),
  groupId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  deleteChildren: z.boolean().describe('If true, recursively delete all child groups and their resources').optional(),
  groups: z.array(z.object({
    id: z.number().describe('Device group ID (preferred). Alias: groupId').optional(),
    groupId: z.number().describe('Alias for id. Prefer using id instead.').optional()
  }).passthrough()).min(1).describe('Array of device group objects with IDs for batch delete').optional(),
  applyToPrevious: z.string().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.').optional(),
  filter: z.string().describe('Delete all device groups matching this LM filter expression').optional(),
  batchOptions: batchOptionsSchema
}).strict();

// Combined operation schema with discriminated union
export const DeviceGroupOperationArgsSchema = z.discriminatedUnion('operation', [
  DeviceGroupListArgsSchema,
  DeviceGroupGetArgsSchema,
  DeviceGroupCreateArgsSchema,
  DeviceGroupUpdateArgsSchema,
  DeviceGroupDeleteArgsSchema
]);

// Type exports
export type DeviceGroupListArgs = z.infer<typeof DeviceGroupListArgsSchema>;
export type DeviceGroupGetArgs = z.infer<typeof DeviceGroupGetArgsSchema>;
export type DeviceGroupCreateArgs = z.infer<typeof DeviceGroupCreateArgsSchema>;
export type DeviceGroupUpdateArgs = z.infer<typeof DeviceGroupUpdateArgsSchema>;
export type DeviceGroupDeleteArgs = z.infer<typeof DeviceGroupDeleteArgsSchema>;
export type DeviceGroupOperationArgs = z.infer<typeof DeviceGroupOperationArgsSchema>;

// Validation helper functions that match the Joi API
export function validateListDeviceGroups(args: unknown) {
  const result = DeviceGroupListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetDeviceGroup(args: unknown) {
  const result = DeviceGroupGetArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateCreateDeviceGroup(args: unknown) {
  const result = DeviceGroupCreateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateUpdateDeviceGroup(args: unknown) {
  const result = DeviceGroupUpdateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateDeleteDeviceGroup(args: unknown) {
  const result = DeviceGroupDeleteArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}
