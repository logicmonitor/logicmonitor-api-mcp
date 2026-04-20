/**
 * Device Data Zod validation schemas
 * Migrated from Joi schemas in deviceDataSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// List datasources operation schema — .strict() rejects unknown parameters
export const DeviceDataListDatasourcesArgsSchema = z.object({
  operation: z.literal('list_datasources').describe('The operation to perform'),
  portal: portalOverrideSchema,
  deviceId: z.number().describe('Device ID to list datasources for'),
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/device_datasource for valid field names.'),
  datasourceIncludeFilter: z.string().optional().describe('Regex pattern to include only matching datasource names'),
  datasourceExcludeFilter: z.string().optional().describe('Regex pattern to exclude matching datasource names'),
  size: z.number().min(1).max(1000).optional().describe('Items per page (default 50, max 1000)'),
  offset: z.number().min(0).optional().describe('Number of items to skip for pagination (default 0)'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"'),
  autoPaginate: z.boolean().optional().describe('When true, automatically fetches all pages. Use cautiously on large result sets.')
}).strict();

// List instances operation schema — .strict() rejects unknown parameters
export const DeviceDataListInstancesArgsSchema = z.object({
  operation: z.literal('list_instances').describe('The operation to perform'),
  portal: portalOverrideSchema,
  deviceId: z.number().describe('Device ID that the datasource belongs to'),
  datasourceId: z.number().describe('The "id" field from list_datasources results (not "dataSourceId"). This is the device-datasource assignment ID.'),
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/device_datasource_instance for valid field names.'),
  size: z.number().min(1).max(1000).optional().describe('Items per page (default 50, max 1000)'),
  offset: z.number().min(0).optional().describe('Number of items to skip for pagination (default 0)'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"'),
  autoPaginate: z.boolean().optional().describe('When true, automatically fetches all pages. Use cautiously on large result sets.')
}).strict();

// Get data operation schema — .strict() rejects unknown parameters
export const DeviceDataGetDataArgsSchema = z.object({
  operation: z.literal('get_data').describe('The operation to perform'),
  portal: portalOverrideSchema,
  deviceId: z.number().describe('Device ID to retrieve monitoring data for'),
  datasourceId: z.number().describe('The "id" field from list_datasources results (not "dataSourceId"). This is the device-datasource assignment ID.'),
  instanceId: z.number().optional().describe('Single instance ID to retrieve data for'),
  instanceIds: z.array(z.number()).optional().describe('Array of instance IDs to retrieve data for in batch'),
  datapoints: z.array(z.string()).optional().describe('Array of datapoint names to return, e.g. ["cpuUsage","memoryUsage"]. Returns all if omitted.'),
  start: z.union([z.number(), z.string()]).optional().describe('Start time: epoch seconds (e.g. 1711152000), ISO date ("2026-03-22T00:00:00Z"), or relative ("-6h", "-24h", "-7d", "-30m"). Defaults to -24h.'),
  startDate: z.union([z.number(), z.string()]).optional().describe('Alias for start. Same formats accepted.'),
  end: z.union([z.number(), z.string()]).optional().describe('End time: epoch seconds, ISO date, or relative ("-1h", "now"). Defaults to now.'),
  endDate: z.union([z.number(), z.string()]).optional().describe('Alias for end. Same formats accepted.'),
  aggregate: z.enum(['none', 'avg', 'sum', 'min', 'max']).optional().describe('Aggregation method for data rollup: none, avg, sum, min, or max'),
  format: z.string().optional().describe('Output format for the data, e.g. "table" or "json"'),
  batchOptions: z.object({
    maxConcurrent: z.number().min(1).max(50).optional().describe('Max parallel API requests (default 5)'),
    continueOnError: z.boolean().optional().describe('If true, continue processing remaining items when one fails'),
    dryRun: z.boolean().optional().describe('If true, validate inputs without executing the operation')
  }).optional().describe('Options for controlling batch operation behavior')
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
