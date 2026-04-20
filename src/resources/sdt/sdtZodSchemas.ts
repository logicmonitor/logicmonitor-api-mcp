/**
 * SDT (Scheduled Down Time) Zod validation schemas
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional().describe('Max parallel API requests (default 5)'),
  continueOnError: z.boolean().optional().describe('If true, continue processing remaining items when one fails'),
  dryRun: z.boolean().optional().describe('If true, validate inputs without executing the operation')
}).optional();

// Single SDT create schema — .loose() allows additional LM API fields
const singleSdtSchema = z.object({
  type: z.string().describe('SDT target resource type: ResourceSDT (device), ResourceGroupSDT (device group), WebsiteSDT, WebsiteGroupSDT, CollectorSDT, DeviceDataSourceSDT, DeviceDataSourceInstanceSDT, DeviceEventSourceSDT, DeviceBatchJobSDT, DeviceClusterAlertDefSDT, DeviceDataSourceInstanceGroupSDT, DeviceLogPipeLineResourceSDT'),
  sdtType: z.string().optional().describe('Schedule type: oneTime, daily, weekly, monthly, or monthlyByWeek. Defaults to oneTime.'),
  startDateTime: z.number().optional().describe('Start time in epoch milliseconds. Required for oneTime SDTs.'),
  endDateTime: z.number().optional().describe('End time in epoch milliseconds. Required for oneTime SDTs.'),
  duration: z.number().optional().describe('Duration in minutes (alternative to endDateTime for recurring SDTs)'),
  timezone: z.string().optional().describe('Timezone for the SDT, e.g. "America/New_York"'),
  comment: z.string().optional().describe('Notes or reason for the SDT'),
  hour: z.number().min(0).max(23).optional().describe('Start hour (0-23) for recurring SDTs'),
  minute: z.number().min(0).max(59).optional().describe('Start minute (0-59) for recurring SDTs'),
  endHour: z.number().min(0).max(23).optional().describe('End hour (0-23) for recurring SDTs'),
  endMinute: z.number().min(0).max(59).optional().describe('End minute (0-59) for recurring SDTs'),
  weekDay: z.string().optional().describe('Day of week for weekly SDTs: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY'),
  monthDay: z.number().min(1).max(31).optional().describe('Day of month (1-31) for monthly SDTs'),
  weekOfMonth: z.string().optional().describe('Week of month for monthlyByWeek SDTs: First, Second, Third, Fourth, Last'),
  deviceId: z.number().optional().describe('Target device ID (for ResourceSDT)'),
  deviceGroupId: z.number().optional().describe('Target device group ID (for ResourceGroupSDT)'),
  deviceDisplayName: z.string().optional().describe('Target device display name (for ResourceSDT)'),
  websiteId: z.number().optional().describe('Target website ID (for WebsiteSDT)'),
  websiteGroupId: z.number().optional().describe('Target website group ID (for WebsiteGroupSDT)'),
  collectorId: z.number().optional().describe('Target collector ID (for CollectorSDT)'),
  dataSourceId: z.number().optional().describe('Target datasource ID (for DeviceDataSourceSDT)'),
  deviceDataSourceId: z.number().optional().describe('Target device datasource ID'),
}).loose();

// List operation schema
export const SdtListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().optional().describe('LM filter expression, e.g. "type:ResourceSDT", "isEffective:true". See health://logicmonitor/fields/sdt for valid field names.'),
  size: z.number().min(1).max(1000).optional().describe('Items per page (default 50, max 1000)'),
  offset: z.number().min(0).optional().describe('Number of items to skip for pagination (default 0)'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,type,sdtType,isEffective"'),
  autoPaginate: z.boolean().optional().describe('When true, automatically fetches all pages. Use cautiously on large result sets.')
}).strict();

// Get operation schema
export const SdtGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.string().optional().describe('SDT ID (string format, e.g. "R_42", "D_15")'),
  fields: z.string().optional().describe('Comma-separated list of fields to return')
}).strict();

// Create operation schema
export const SdtCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  type: z.string().optional().describe('SDT target resource type: ResourceSDT (device), ResourceGroupSDT (device group), WebsiteSDT, WebsiteGroupSDT, CollectorSDT, DeviceDataSourceSDT, etc. Required when sdts is not provided.'),
  sdtType: z.string().optional().describe('Schedule type: oneTime, daily, weekly, monthly, or monthlyByWeek. Defaults to oneTime.'),
  startDateTime: z.number().optional().describe('Start time in epoch milliseconds'),
  endDateTime: z.number().optional().describe('End time in epoch milliseconds'),
  duration: z.number().optional().describe('Duration in minutes (alternative to endDateTime for recurring SDTs)'),
  timezone: z.string().optional().describe('Timezone for the SDT, e.g. "America/New_York"'),
  comment: z.string().optional().describe('Notes or reason for the SDT'),
  hour: z.number().min(0).max(23).optional().describe('Start hour (0-23) for recurring SDTs'),
  minute: z.number().min(0).max(59).optional().describe('Start minute (0-59) for recurring SDTs'),
  endHour: z.number().min(0).max(23).optional().describe('End hour (0-23) for recurring SDTs'),
  endMinute: z.number().min(0).max(59).optional().describe('End minute (0-59) for recurring SDTs'),
  weekDay: z.string().optional().describe('Day of week for weekly SDTs: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY'),
  monthDay: z.number().min(1).max(31).optional().describe('Day of month (1-31) for monthly SDTs'),
  weekOfMonth: z.string().optional().describe('Week of month for monthlyByWeek SDTs: First, Second, Third, Fourth, Last'),
  deviceId: z.number().optional().describe('Target device ID (for ResourceSDT)'),
  deviceGroupId: z.number().optional().describe('Target device group ID (for ResourceGroupSDT)'),
  deviceDisplayName: z.string().optional().describe('Target device display name (for ResourceSDT)'),
  websiteId: z.number().optional().describe('Target website ID (for WebsiteSDT)'),
  websiteGroupId: z.number().optional().describe('Target website group ID (for WebsiteGroupSDT)'),
  collectorId: z.number().optional().describe('Target collector ID (for CollectorSDT)'),
  dataSourceId: z.number().optional().describe('Target datasource ID (for DeviceDataSourceSDT)'),
  deviceDataSourceId: z.number().optional().describe('Target device datasource ID'),
  sdts: z.array(singleSdtSchema).min(1).optional().describe('Array of SDT definitions for batch creation.'),
  batchOptions: batchOptionsSchema.describe('Options for controlling batch operation behavior.')
}).loose()
.superRefine((data, ctx) => {
  if (!data.sdts && !data.type) {
    ctx.addIssue({
      code: 'custom',
      message: 'type is required when sdts is not provided',
      path: ['type']
    });
  }
});

// Update operation schema
export const SdtUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.string().optional().describe('SDT ID (string format, e.g. "R_42")'),
  sdtType: z.string().optional().describe('Updated schedule type'),
  startDateTime: z.number().optional().describe('Updated start time in epoch milliseconds'),
  endDateTime: z.number().optional().describe('Updated end time in epoch milliseconds'),
  duration: z.number().optional().describe('Updated duration in minutes'),
  timezone: z.string().optional().describe('Updated timezone'),
  comment: z.string().optional().describe('Updated notes or reason'),
  hour: z.number().min(0).max(23).optional().describe('Updated start hour'),
  minute: z.number().min(0).max(59).optional().describe('Updated start minute'),
  endHour: z.number().min(0).max(23).optional().describe('Updated end hour'),
  endMinute: z.number().min(0).max(59).optional().describe('Updated end minute'),
  weekDay: z.string().optional().describe('Updated day of week'),
  monthDay: z.number().min(1).max(31).optional().describe('Updated day of month'),
  weekOfMonth: z.string().optional().describe('Updated week of month'),
  sdts: z.array(z.object({ id: z.string().optional().describe('SDT ID') }).passthrough()).min(1).optional().describe('Array of SDT references for batch update. Each must include id.'),
  updates: z.record(z.string(), z.unknown()).optional().describe('Key-value map of fields to update across all targeted SDTs.'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list, e.g. "lastSdtListIds". Use lm_session list to see available variables.'),
  filter: z.string().optional().describe('LM filter expression to select SDTs for batch update.'),
  batchOptions: batchOptionsSchema.describe('Options for controlling batch operation behavior.')
}).loose();

// Delete operation schema
export const SdtDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.string().optional().describe('SDT ID (string format, e.g. "R_42")'),
  ids: z.array(z.string()).optional().describe('Array of SDT IDs to delete in batch.'),
  sdts: z.array(z.object({ id: z.string().optional().describe('SDT ID') }).passthrough()).min(1).optional().describe('Array of SDT references for batch deletion. Each must include id.'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list.'),
  filter: z.string().optional().describe('LM filter expression to select SDTs for batch deletion.'),
  batchOptions: batchOptionsSchema.describe('Options for controlling batch operation behavior.')
}).strict();

// Combined operation schema
export const SdtOperationArgsSchema = z.discriminatedUnion('operation', [
  SdtListArgsSchema,
  SdtGetArgsSchema,
  SdtCreateArgsSchema,
  SdtUpdateArgsSchema,
  SdtDeleteArgsSchema
]);

// Type exports
export type SdtListArgs = z.infer<typeof SdtListArgsSchema>;
export type SdtGetArgs = z.infer<typeof SdtGetArgsSchema>;
export type SdtCreateArgs = z.infer<typeof SdtCreateArgsSchema>;
export type SdtUpdateArgs = z.infer<typeof SdtUpdateArgsSchema>;
export type SdtDeleteArgs = z.infer<typeof SdtDeleteArgsSchema>;
export type SdtOperationArgs = z.infer<typeof SdtOperationArgsSchema>;

// Validation helper functions
function formatError(error: z.ZodError) {
  return error.issues.map(e => `${String(e.path.join('.'))}: ${e.message}`).join(', ');
}

export function validateListSdts(args: unknown) {
  const result = SdtListArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}

export function validateGetSdt(args: unknown) {
  const result = SdtGetArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}

export function validateCreateSdt(args: unknown) {
  const result = SdtCreateArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}

export function validateUpdateSdt(args: unknown) {
  const result = SdtUpdateArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}

export function validateDeleteSdt(args: unknown) {
  const result = SdtDeleteArgsSchema.safeParse(args);
  if (!result.success) throw new McpError(ErrorCode.InvalidParams, `Validation error: ${formatError(result.error)}`);
  return result.data;
}
