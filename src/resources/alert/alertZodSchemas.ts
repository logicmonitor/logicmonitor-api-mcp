/**
 * Alert Zod validation schemas
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Base schemas for alert list operation
export const AlertListArgsSchema = z.object({
  operation: z.literal('list'),
  filter: z.string().optional(),
  fields: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  autoPaginate: z.boolean().optional(),
  sort: z.string().optional(),
  needMessage: z.boolean().optional(),
  customColumns: z.string().optional()
}).strict();

// Base schemas for alert get operation
export const AlertGetArgsSchema = z.object({
  operation: z.literal('get'),
  id: z.union([z.string(), z.number()]).optional(),
  alertId: z.union([z.string(), z.number()]).optional()
}).strict();

// Base schemas for alert update operation (ack, note, escalate)
const AlertAckArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.union([z.string(), z.number()]).optional(),
  alertId: z.union([z.string(), z.number()]).optional(),
  action: z.literal('ack'),
  ackComment: z.string()
}).strict();

const AlertNoteArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.union([z.string(), z.number()]).optional(),
  alertId: z.union([z.string(), z.number()]).optional(),
  action: z.literal('note'),
  note: z.string()
}).strict();

const AlertEscalateArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.union([z.string(), z.number()]).optional(),
  alertId: z.union([z.string(), z.number()]).optional(),
  action: z.literal('escalate')
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

// Validation helper functions
export function validateAlertOperation(args: unknown): AlertOperationArgs {
  const result = AlertOperationArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

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

