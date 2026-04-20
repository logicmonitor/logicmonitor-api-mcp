/**
 * Alert Zod validation schemas
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// List operation schema — .strict() rejects unknown parameters
export const AlertListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().optional().describe('LM filter expression. Examples: "severity:4" (critical), "severity:3" (error), "resourceTemplateName:CPU*". Severity levels: 2=warning, 3=error, 4=critical. See health://logicmonitor/fields/alert for valid field names.'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"'),
  size: z.number().min(1).max(1000).optional().describe('Items per page (default 50, max 1000)'),
  offset: z.number().min(0).optional().describe('Number of items to skip for pagination (default 0)'),
  autoPaginate: z.boolean().optional().describe('When true, automatically fetches all pages. Use cautiously on large result sets.'),
  sort: z.string().optional().describe('Sort expression, e.g. "+severity" or "-startEpoch". Prefix with + for ascending, - for descending.'),
  needMessage: z.boolean().optional().describe('When true, includes the alert body/message content in the response.'),
  customColumns: z.string().optional().describe('Comma-separated list of custom column names to include in the response.')
}).strict();

// Get operation schema — .strict() rejects unknown parameters
export const AlertGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.union([z.string(), z.number()]).optional().describe('Alert ID (preferred). Alias: alertId'),
  alertId: z.union([z.string(), z.number()]).optional().describe('Alias for id. Prefer using id instead.')
}).strict();

// Ack operation schema — .strict() rejects unknown parameters
const AlertAckArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.union([z.string(), z.number()]).optional().describe('Alert ID (preferred). Alias: alertId'),
  alertId: z.union([z.string(), z.number()]).optional().describe('Alias for id. Prefer using id instead.'),
  action: z.literal('ack').describe('The update action to perform: acknowledge the alert.'),
  ackComment: z.string().describe('Comment to attach when acknowledging the alert.')
}).strict();

// Note operation schema — .strict() rejects unknown parameters
const AlertNoteArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.union([z.string(), z.number()]).optional().describe('Alert ID (preferred). Alias: alertId'),
  alertId: z.union([z.string(), z.number()]).optional().describe('Alias for id. Prefer using id instead.'),
  action: z.literal('note').describe('The update action to perform: add a note to the alert.'),
  note: z.string().describe('Note text to add to the alert.')
}).strict();

// Escalate operation schema — .strict() rejects unknown parameters
const AlertEscalateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.union([z.string(), z.number()]).optional().describe('Alert ID (preferred). Alias: alertId'),
  alertId: z.union([z.string(), z.number()]).optional().describe('Alias for id. Prefer using id instead.'),
  action: z.literal('escalate').describe('The update action to perform: escalate the alert to the next escalation chain stage.')
}).strict();

export const AlertUpdateArgsSchema = z.discriminatedUnion('action', [
  AlertAckArgsSchema,
  AlertNoteArgsSchema,
  AlertEscalateArgsSchema
]);

// Combined operation schema with discriminated union
export const AlertOperationArgsSchema = z.discriminatedUnion('operation', [
  AlertListArgsSchema,
  AlertGetArgsSchema,
  AlertUpdateArgsSchema
]);

// Type exports
export type AlertListArgs = z.infer<typeof AlertListArgsSchema>;
export type AlertGetArgs = z.infer<typeof AlertGetArgsSchema>;
export type AlertUpdateArgs = z.infer<typeof AlertUpdateArgsSchema>;
export type AlertOperationArgs = z.infer<typeof AlertOperationArgsSchema>;


export function validateListAlerts(args: unknown) {
  const result = AlertListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetAlert(args: unknown) {
  const result = AlertGetArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateUpdateAlert(args: unknown) {
  const result = AlertUpdateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}
