/**
 * Device Zod validation schemas
 * Migrated from Joi schemas in deviceSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@socotra/modelcontextprotocol-sdk/types.js';

// Common schemas
const propertySchema = z.object({
  name: z.string(),
  value: z.string()
}).loose();

const customPropertySchema = z.object({
  name: z.string(),
  value: z.string()
}).loose();

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional(),
  continueOnError: z.boolean().optional(),
  dryRun: z.boolean().optional()
}).optional();

// Single device create schema
const singleDeviceSchema = z.object({
  displayName: z.string(),
  name: z.string(),
  hostGroupIds: z.array(z.number()).min(1),
  preferredCollectorId: z.number(),
  disableAlerting: z.boolean().optional(),
  properties: z.array(propertySchema).optional(),
  customProperties: z.array(customPropertySchema).optional()
}).loose();

// Single device update schema
const singleUpdateDeviceSchema = z.object({
  deviceId: z.number().optional(),
  id: z.number().optional(),
  displayName: z.string().optional(),
  hostGroupIds: z.array(z.number()).optional(),
  disableAlerting: z.boolean().optional(),
  customProperties: z.array(customPropertySchema).optional(),
  properties: z.array(propertySchema).optional()
}).loose();

// List operation schema
export const DeviceListArgsSchema = z.object({
  operation: z.literal('list'),
  filter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  netflowFilter: z.string().optional(),
  includeDeletedResources: z.boolean().optional()
}).strict();

// Get operation schema
export const DeviceGetArgsSchema = z.object({
  operation: z.literal('get'),
  id: z.number().optional(),
  deviceId: z.number().optional(),
  fields: z.string().optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  netflowFilter: z.string().optional(),
  needStcGrpAndSortedCP: z.boolean().optional()
}).strict();

// Create operation schema
export const DeviceCreateArgsSchema = z.object({
  operation: z.literal('create'),
  displayName: z.string().optional(),
  name: z.string().optional(),
  hostGroupIds: z.array(z.number()).min(1).optional(),
  preferredCollectorId: z.number().optional(),
  disableAlerting: z.boolean().optional(),
  properties: z.array(propertySchema).optional(),
  customProperties: z.array(customPropertySchema).optional(),
  devices: z.array(singleDeviceSchema).min(1).optional(),
  batchOptions: batchOptionsSchema
}).loose()
.superRefine((data, ctx) => {
  // Must have either displayName or devices, but not both (xor)
  const hasDisplayName = data.displayName !== undefined;
  const hasDevices = data.devices !== undefined;
  
  if (hasDisplayName && hasDevices) {
    ctx.addIssue({
      code: 'custom',
      message: 'Cannot specify both displayName and devices',
      path: ['displayName']
    });
  }
  
  if (!hasDisplayName && !hasDevices) {
    ctx.addIssue({
      code: 'custom',
      message: 'Must specify either displayName or devices',
      path: ['displayName']
    });
  }
  
  // If not using devices array, require single device fields
  if (!hasDevices) {
    if (!data.displayName) {
      ctx.addIssue({
        code: 'custom',
        message: 'displayName is required when devices is not provided',
        path: ['displayName']
      });
    }
    if (!data.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'name is required when devices is not provided',
        path: ['name']
      });
    }
    if (!data.hostGroupIds) {
      ctx.addIssue({
        code: 'custom',
        message: 'hostGroupIds is required when devices is not provided',
        path: ['hostGroupIds']
      });
    }
    if (!data.preferredCollectorId) {
      ctx.addIssue({
        code: 'custom',
        message: 'preferredCollectorId is required when devices is not provided',
        path: ['preferredCollectorId']
      });
    }
  }
});

// Update operation schema
export const DeviceUpdateArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.number().optional(),
  deviceId: z.number().optional(),
  displayName: z.string().optional(),
  hostGroupIds: z.array(z.number()).optional(),
  disableAlerting: z.boolean().optional(),
  customProperties: z.array(customPropertySchema).optional(),
  properties: z.array(propertySchema).optional(),
  devices: z.array(singleUpdateDeviceSchema).min(1).optional(),
  updates: z.record(z.string(), z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema
export const DeviceDeleteArgsSchema = z.object({
  operation: z.literal('delete'),
  id: z.number().optional(),
  deviceId: z.number().optional(),
  ids: z.array(z.number()).optional(),
  devices: z.array(z.object({
    deviceId: z.number().optional(),
    id: z.number().optional()
  }).strict()).min(1).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).strict();

// Combined operation schema with discriminated union
export const DeviceOperationArgsSchema = z.discriminatedUnion('operation', [
  DeviceListArgsSchema,
  DeviceGetArgsSchema,
  DeviceCreateArgsSchema,
  DeviceUpdateArgsSchema,
  DeviceDeleteArgsSchema
]);

// Type exports
export type DeviceListArgs = z.infer<typeof DeviceListArgsSchema>;
export type DeviceGetArgs = z.infer<typeof DeviceGetArgsSchema>;
export type DeviceCreateArgs = z.infer<typeof DeviceCreateArgsSchema>;
export type DeviceUpdateArgs = z.infer<typeof DeviceUpdateArgsSchema>;
export type DeviceDeleteArgs = z.infer<typeof DeviceDeleteArgsSchema>;
export type DeviceOperationArgs = z.infer<typeof DeviceOperationArgsSchema>;

// Validation helper functions that match the Joi API
export function validateListDevices(args: unknown) {
  const result = DeviceListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetDevice(args: unknown) {
  const result = DeviceGetArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateCreateDevice(args: unknown) {
  const result = DeviceCreateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateUpdateDevice(args: unknown) {
  const result = DeviceUpdateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateDeleteDevice(args: unknown) {
  const result = DeviceDeleteArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

