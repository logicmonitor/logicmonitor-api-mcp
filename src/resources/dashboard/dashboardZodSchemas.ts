/**
 * Dashboard Zod validation schemas
 * Migrated from Joi schemas in dashboardSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Common schemas
const widgetTokenSchema = z.object({
  name: z.string(),
  value: z.string()
});

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional(),
  continueOnError: z.boolean().optional(),
  dryRun: z.boolean().optional()
}).optional();

// Single dashboard create schema
const singleDashboardSchema = z.object({
  name: z.string(),
  groupId: z.number(),
  description: z.string().optional(),
  widgetsConfig: z.string().optional(),
  widgetTokens: z.array(widgetTokenSchema).optional(),
  template: z.boolean().optional(),
  sharable: z.boolean().optional()
}).loose();

// List operation schema
export const DashboardListArgsSchema = z.object({
  operation: z.literal('list'),
  filter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional()
}).strict();

// Get operation schema
export const DashboardGetArgsSchema = z.object({
  operation: z.literal('get'),
  id: z.number().optional(),
  dashboardId: z.number().optional(),
  fields: z.string().optional()
}).strict();

// Create operation schema
export const DashboardCreateArgsSchema = z.object({
  operation: z.literal('create'),
  name: z.string().optional(),
  groupId: z.number().optional(),
  description: z.string().optional(),
  widgetsConfig: z.string().optional(),
  widgetTokens: z.array(widgetTokenSchema).optional(),
  template: z.boolean().optional(),
  sharable: z.boolean().optional(),
  dashboards: z.array(singleDashboardSchema).min(1).optional(),
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

// Update operation schema
export const DashboardUpdateArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.number().optional(),
  dashboardId: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  widgetsConfig: z.string().optional(),
  widgetTokens: z.array(widgetTokenSchema).optional(),
  template: z.boolean().optional(),
  sharable: z.boolean().optional(),
  dashboards: z.array(z.any()).optional(),
  updates: z.record(z.string(), z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema
export const DashboardDeleteArgsSchema = z.object({
  operation: z.literal('delete'),
  id: z.number().optional(),
  dashboardId: z.number().optional(),
  ids: z.array(z.number()).optional(),
  dashboards: z.array(z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
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

