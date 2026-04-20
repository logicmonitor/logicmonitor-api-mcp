/**
 * Device Zod validation schemas
 * Migrated from Joi schemas in deviceSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// Common schemas
const propertySchema = z.object({
  name: z.string().describe('Property name'),
  value: z.string().describe('Property value')
}).loose();

const customPropertySchema = z.object({
  name: z.string().describe('Custom property name'),
  value: z.string().describe('Custom property value')
}).loose();

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).describe('Max parallel API requests (default 5)').optional(),
  continueOnError: z.boolean().describe('If true, continue processing remaining items when one fails').optional(),
  dryRun: z.boolean().describe('If true, validate inputs without executing the operation').optional()
}).describe('Options for controlling batch execution behavior').optional();

// Single device create schema (used in batch create via 'devices' array)
const singleDeviceSchema = z.object({
  displayName: z.string().describe('Display name shown in the LM portal'),
  name: z.string().describe('Hostname, IP address, or DNS name used for monitoring'),
  hostGroupIds: z.array(z.number()).min(1).describe('Array of device group IDs to assign this device to'),
  preferredCollectorId: z.number().describe('ID of the collector to use for monitoring this device'),
  disableAlerting: z.boolean().describe('If true, suppress alerts for this device').optional(),
  properties: z.array(propertySchema).describe('System properties for this device').optional(),
  customProperties: z.array(customPropertySchema).describe('Custom properties (key-value pairs) for this device').optional()
}).loose(); // .loose() allows additional LM API fields not explicitly listed

// Single device update schema (used in batch update via 'devices' array)
const singleUpdateDeviceSchema = z.object({
  id: z.number().describe('Device ID (preferred). Alias: deviceId').optional(),
  deviceId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  displayName: z.string().describe('New display name for the device').optional(),
  hostGroupIds: z.array(z.number()).describe('New array of device group IDs').optional(),
  disableAlerting: z.boolean().describe('If true, suppress alerts for this device').optional(),
  customProperties: z.array(customPropertySchema).describe('Custom properties to set').optional(),
  properties: z.array(propertySchema).describe('System properties to set').optional()
}).loose(); // .loose() allows additional LM API fields not explicitly listed

// List operation schema — .strict() rejects unknown parameters
export const DeviceListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().describe('LM filter expression. Common fields: displayName, hostStatus, currentCollectorId, hostGroupIds. Examples: "displayName:*prod*", "hostStatus:dead". See health://logicmonitor/fields/device for all valid field names.').optional(),
  size: z.number().min(1).max(1000).describe('Items per page (default 50, max 1000)').optional(),
  offset: z.number().min(0).describe('Number of items to skip for pagination (default 0)').optional(),
  fields: z.string().describe('Comma-separated list of fields to return, e.g. "id,displayName,hostStatus"').optional(),
  autoPaginate: z.boolean().describe('When true, automatically fetches all pages. Use cautiously on large result sets.').optional(),
  start: z.number().describe('Start time as epoch seconds (e.g. 1711152000). Used for netflow time-range filtering.').optional(),
  end: z.number().describe('End time as epoch seconds (e.g. 1711238400). Used for netflow time-range filtering.').optional(),
  netflowFilter: z.string().describe('Netflow filter expression for netflow-enabled devices').optional(),
  includeDeletedResources: z.boolean().describe('If true, include soft-deleted devices in results').optional()
}).strict();

// Get operation schema — .strict() rejects unknown parameters
export const DeviceGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Device ID (preferred). Alias: deviceId').optional(),
  deviceId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  fields: z.string().describe('Comma-separated list of fields to return, e.g. "id,displayName,hostStatus"').optional(),
  start: z.number().describe('Start time as epoch seconds (e.g. 1711152000). Used for netflow time-range filtering.').optional(),
  end: z.number().describe('End time as epoch seconds (e.g. 1711238400). Used for netflow time-range filtering.').optional(),
  netflowFilter: z.string().describe('Netflow filter expression for netflow-enabled devices').optional(),
  needStcGrpAndSortedCP: z.boolean().describe('If true, include static group info and sorted custom properties').optional()
}).strict();

// Create operation schema — .loose() allows additional LM API fields not explicitly listed
export const DeviceCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  displayName: z.string().describe('Display name for a single device. Mutually exclusive with devices array.').optional(),
  name: z.string().describe('Hostname, IP address, or DNS name. Required when using displayName (single create).').optional(),
  hostGroupIds: z.array(z.number()).min(1).describe('Device group IDs to assign. Required when using displayName (single create).').optional(),
  preferredCollectorId: z.number().describe('Collector ID for monitoring. Required when using displayName (single create).').optional(),
  disableAlerting: z.boolean().describe('If true, suppress alerts for this device').optional(),
  properties: z.array(propertySchema).describe('System properties for this device').optional(),
  customProperties: z.array(customPropertySchema).describe('Custom properties (key-value pairs) for this device').optional(),
  devices: z.array(singleDeviceSchema).min(1).describe('Array of devices for batch create. Mutually exclusive with displayName.').optional(),
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

// Update operation schema — .loose() allows additional LM API fields not explicitly listed
export const DeviceUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Device ID to update (preferred). Alias: deviceId').optional(),
  deviceId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  displayName: z.string().describe('New display name for the device').optional(),
  hostGroupIds: z.array(z.number()).describe('New array of device group IDs').optional(),
  disableAlerting: z.boolean().describe('If true, suppress alerts for this device').optional(),
  customProperties: z.array(customPropertySchema).describe('Custom properties to set').optional(),
  properties: z.array(propertySchema).describe('System properties to set').optional(),
  devices: z.array(singleUpdateDeviceSchema).min(1).describe('Array of device objects for batch update, each with its own id and fields to change').optional(),
  updates: z.record(z.string(), z.unknown()).describe('Key-value map of fields to update, applied to the target device(s)').optional(),
  applyToPrevious: z.string().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.').optional(),
  filter: z.string().describe('Apply this update to all devices matching the LM filter expression').optional(),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema — .strict() rejects unknown parameters
export const DeviceDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Device ID to delete (preferred). Alias: deviceId').optional(),
  deviceId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  ids: z.array(z.number()).describe('Array of device IDs to delete in batch').optional(),
  devices: z.array(z.object({
    id: z.number().describe('Device ID (preferred). Alias: deviceId').optional(),
    deviceId: z.number().describe('Alias for id. Prefer using id instead.').optional()
  }).strict()).min(1).describe('Array of device objects with IDs for batch delete').optional(),
  applyToPrevious: z.string().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.').optional(),
  filter: z.string().describe('Delete all devices matching this LM filter expression').optional(),
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
