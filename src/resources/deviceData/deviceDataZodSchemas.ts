/**
 * Device Data Zod validation schemas
 * Migrated from Joi schemas in deviceDataSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@socotra/modelcontextprotocol-sdk/types.js';

// List datasources operation schema
export const DeviceDataListDatasourcesArgsSchema = z.object({
  operation: z.literal('list_datasources'),
  deviceId: z.number(),
  filter: z.string().optional(),
  datasourceIncludeFilter: z.string().optional(),
  datasourceExcludeFilter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional()
}).strict();

// List instances operation schema
export const DeviceDataListInstancesArgsSchema = z.object({
  operation: z.literal('list_instances'),
  deviceId: z.number(),
  datasourceId: z.number(),
  filter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional()
}).strict();

// Get data operation schema
export const DeviceDataGetDataArgsSchema = z.object({
  operation: z.literal('get_data'),
  deviceId: z.number(),
  datasourceId: z.number(),
  instanceId: z.number().optional(),
  instanceIds: z.array(z.number()).optional(),
  datapoints: z.array(z.string()).optional(),
  start: z.union([z.number(), z.string()]).optional(),
  startDate: z.union([z.number(), z.string()]).optional(),
  end: z.union([z.number(), z.string()]).optional(),
  endDate: z.union([z.number(), z.string()]).optional(),
  aggregate: z.enum(['none', 'avg', 'sum', 'min', 'max']).optional(),
  format: z.string().optional(),
  batchOptions: z.object({
    maxConcurrent: z.number().min(1).max(50).optional(),
    continueOnError: z.boolean().optional(),
    dryRun: z.boolean().optional()
  }).optional()
}).strict();

// Combined operation schema with discriminated union
export const DeviceDataOperationArgsSchema = z.discriminatedUnion('operation', [
  DeviceDataListDatasourcesArgsSchema,
  DeviceDataListInstancesArgsSchema,
  DeviceDataGetDataArgsSchema
]);

// Type exports
export type DeviceDataListDatasourcesArgs = z.infer<typeof DeviceDataListDatasourcesArgsSchema>;
export type DeviceDataListInstancesArgs = z.infer<typeof DeviceDataListInstancesArgsSchema>;
export type DeviceDataGetDataArgs = z.infer<typeof DeviceDataGetDataArgsSchema>;
export type DeviceDataOperationArgs = z.infer<typeof DeviceDataOperationArgsSchema>;

// Validation helper functions
export function validateListDatasources(args: unknown) {
  const result = DeviceDataListDatasourcesArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateListInstances(args: unknown) {
  const result = DeviceDataListInstancesArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetData(args: unknown) {
  const result = DeviceDataGetDataArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

