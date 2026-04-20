/**
 * Dashboard Zod validation schemas
 * Migrated from Joi schemas in dashboardSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// Common schemas
const widgetTokenSchema = z.object({
  name: z.string().describe('Token name used in widget configuration'),
  value: z.string().describe('Token value to substitute')
});

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional().describe('Max parallel API requests (default 5)'),
  continueOnError: z.boolean().optional().describe('If true, continue processing remaining items when one fails'),
  dryRun: z.boolean().optional().describe('If true, validate inputs without executing the operation')
}).optional().describe('Options for controlling batch operation behavior');

// Single dashboard create schema — .loose() allows additional LM API fields not explicitly listed
const singleDashboardSchema = z.object({
  name: z.string().describe('Display name of the dashboard'),
  groupId: z.number().describe('ID of the dashboard group to place this dashboard in'),
  description: z.string().optional().describe('Description of the dashboard'),
  widgetsConfig: z.string().optional().describe('JSON string defining widget layout and configuration'),
  widgetTokens: z.array(widgetTokenSchema).optional().describe('Array of token name/value pairs for dynamic widget content'),
  template: z.boolean().optional().describe('If true, dashboard is a template that can be cloned'),
  sharable: z.boolean().optional().describe('If true, dashboard can be shared with other users')
}).loose();

// List operation schema — .strict() rejects unknown parameters
export const DashboardListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/dashboard for valid field names.'),
  size: z.number().min(1).max(1000).optional().describe('Items per page (default 50, max 1000)'),
  offset: z.number().min(0).optional().describe('Number of items to skip for pagination (default 0)'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"'),
  autoPaginate: z.boolean().optional().describe('When true, automatically fetches all pages. Use cautiously on large result sets.')
}).strict();

// Get operation schema — .strict() rejects unknown parameters
export const DashboardGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().optional().describe('Dashboard ID (preferred). Alias: dashboardId'),
  dashboardId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"')
}).strict();

// Create operation schema — .loose() allows additional LM API fields not explicitly listed
export const DashboardCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  name: z.string().optional().describe('Display name of the dashboard (required for single create)'),
  groupId: z.number().optional().describe('ID of the dashboard group (required for single create)'),
  description: z.string().optional().describe('Description of the dashboard'),
  widgetsConfig: z.string().optional().describe('JSON string defining widget layout and configuration'),
  widgetTokens: z.array(widgetTokenSchema).optional().describe('Array of token name/value pairs for dynamic widget content'),
  template: z.boolean().optional().describe('If true, dashboard is a template that can be cloned'),
  sharable: z.boolean().optional().describe('If true, dashboard can be shared with other users'),
  dashboards: z.array(singleDashboardSchema).min(1).optional().describe('Array of dashboard objects for batch creation'),
  batchOptions: batchOptionsSchema
}).loose()
.superRefine((data, ctx) => {
  // If not using dashboards array, require single dashboard fields
  if (!data.dashboards) {
    if (!data.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'name is required when dashboards is not provided',
        path: ['name']
      });
    }
    if (!data.groupId) {
      ctx.addIssue({
        code: 'custom',
        message: 'groupId is required when dashboards is not provided',
        path: ['groupId']
      });
    }
  }
});

// Update operation schema — .loose() allows additional LM API fields not explicitly listed
export const DashboardUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().optional().describe('Dashboard ID (preferred). Alias: dashboardId'),
  dashboardId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  name: z.string().optional().describe('Display name of the dashboard'),
  description: z.string().optional().describe('Description of the dashboard'),
  widgetsConfig: z.string().optional().describe('JSON string defining widget layout and configuration'),
  widgetTokens: z.array(widgetTokenSchema).optional().describe('Array of token name/value pairs for dynamic widget content'),
  template: z.boolean().optional().describe('If true, dashboard is a template that can be cloned'),
  sharable: z.boolean().optional().describe('If true, dashboard can be shared with other users'),
  dashboards: z.array(z.object({ id: z.number().optional().describe('Dashboard ID (preferred). Alias: dashboardId'), dashboardId: z.number().optional().describe('Alias for id. Prefer using id instead.') }).passthrough()).min(1).optional().describe('Array of dashboard objects for batch update'),
  updates: z.record(z.string(), z.unknown()).optional().describe('Key-value pairs of fields to update across all targeted dashboards'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.'),
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/dashboard for valid field names.'),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema — .strict() rejects unknown parameters
export const DashboardDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().optional().describe('Dashboard ID (preferred). Alias: dashboardId'),
  dashboardId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  ids: z.array(z.number()).optional().describe('Array of dashboard IDs to delete in batch'),
  dashboards: z.array(z.object({ id: z.number().optional().describe('Dashboard ID (preferred). Alias: dashboardId'), dashboardId: z.number().optional().describe('Alias for id. Prefer using id instead.') }).passthrough()).min(1).optional().describe('Array of dashboard objects for batch deletion'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.'),
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/dashboard for valid field names.'),
  batchOptions: batchOptionsSchema
}).strict();

// Combined operation schema with discriminated union
export const DashboardOperationArgsSchema = z.discriminatedUnion('operation', [
  DashboardListArgsSchema,
  DashboardGetArgsSchema,
  DashboardCreateArgsSchema,
  DashboardUpdateArgsSchema,
  DashboardDeleteArgsSchema
]);

// Type exports
export type DashboardListArgs = z.infer<typeof DashboardListArgsSchema>;
export type DashboardGetArgs = z.infer<typeof DashboardGetArgsSchema>;
export type DashboardCreateArgs = z.infer<typeof DashboardCreateArgsSchema>;
export type DashboardUpdateArgs = z.infer<typeof DashboardUpdateArgsSchema>;
export type DashboardDeleteArgs = z.infer<typeof DashboardDeleteArgsSchema>;
export type DashboardOperationArgs = z.infer<typeof DashboardOperationArgsSchema>;

// Validation helper function
export function validateDashboardOperation(args: unknown): DashboardOperationArgs {
  const result = DashboardOperationArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}
