/**
 * Device Group Zod validation schemas
 * Migrated from Joi schemas in deviceGroupSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Common schemas
const customPropertySchema = z.object({
  name: z.string(),
  value: z.string()
});

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional(),
  continueOnError: z.boolean().optional(),
  dryRun: z.boolean().optional()
}).optional();

// List operation schema
export const DeviceGroupListArgsSchema = z.object({
  operation: z.literal('list'),
  filter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional(),
  parentId: z.number().optional()
}).strict();

// Get operation schema
export const DeviceGroupGetArgsSchema = z.object({
  operation: z.literal('get'),
  id: z.number().optional(),
  groupId: z.number().optional(),
  fields: z.string().optional()
}).strict();

// Create operation schema
const singleGroupCreateSchema = z.object({
  name: z.string(),
  parentId: z.number(),
  description: z.string().optional(),
  appliesTo: z.string().optional(),
  customProperties: z.array(customPropertySchema).optional()
}).loose(); // Allow unknown properties like Joi's unknown(true)

export const DeviceGroupCreateArgsSchema = z.object({
  operation: z.literal('create'),
  name: z.string().optional(),
  parentId: z.number().optional(),
  description: z.string().optional(),
  appliesTo: z.string().optional(),
  customProperties: z.array(customPropertySchema).optional(),
  groups: z.array(singleGroupCreateSchema).min(1).optional(),
  batchOptions: batchOptionsSchema
}).loose() // Allow unknown properties
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

// Update operation schema
export const DeviceGroupUpdateArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.number().optional(),
  groupId: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  appliesTo: z.string().optional(),
  customProperties: z.array(customPropertySchema).optional(),
  groups: z.array(z.any()).optional(),
  updates: z.record(z.string(), z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).loose(); // Allow unknown properties

// Delete operation schema
export const DeviceGroupDeleteArgsSchema = z.object({
  operation: z.literal('delete'),
  id: z.number().optional(),
  groupId: z.number().optional(),
  deleteChildren: z.boolean().optional(),
  groups: z.array(z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
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

