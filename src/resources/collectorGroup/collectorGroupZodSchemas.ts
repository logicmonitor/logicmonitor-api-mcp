/**
 * Collector Group Zod validation schemas
 * Migrated from Joi schemas in collectorGroupSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@socotra/modelcontextprotocol-sdk/types.js';

// Common schemas
const propertySchema = z.object({
  name: z.string(),
  value: z.string()
});

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional(),
  continueOnError: z.boolean().optional(),
  dryRun: z.boolean().optional()
}).optional();

// Single group create schema
const singleGroupSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  properties: z.array(propertySchema).optional(),
  autoBalance: z.boolean().optional(),
  autoBalanceInstanceCountThreshold: z.number().optional()
}).loose();

// List operation schema
export const CollectorGroupListArgsSchema = z.object({
  operation: z.literal('list'),
  filter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional()
}).strict();

// Get operation schema
export const CollectorGroupGetArgsSchema = z.object({
  operation: z.literal('get'),
  id: z.number().optional(),
  groupId: z.number().optional(),
  fields: z.string().optional()
}).strict();

// Create operation schema
export const CollectorGroupCreateArgsSchema = z.object({
  operation: z.literal('create'),
  name: z.string().optional(),
  description: z.string().optional(),
  properties: z.array(propertySchema).optional(),
  customProperties: z.array(propertySchema).optional(),
  autoBalance: z.boolean().optional(),
  autoBalanceInstanceCountThreshold: z.number().optional(),
  groups: z.array(singleGroupSchema).min(1).optional(),
  batchOptions: batchOptionsSchema
}).loose()
.superRefine((data, ctx) => {
  // If not using groups array, require name
  if (!data.groups && !data.name) {
    ctx.addIssue({
      code: 'custom',
      message: 'name is required when groups is not provided',
      path: ['name']
    });
  }
});

// Update operation schema
export const CollectorGroupUpdateArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.number().optional(),
  groupId: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  properties: z.array(propertySchema).optional(),
  customProperties: z.array(propertySchema).optional(),
  autoBalance: z.boolean().optional(),
  autoBalanceInstanceCountThreshold: z.number().optional(),
  groups: z.array(z.any()).optional(),
  updates: z.record(z.string(), z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema
export const CollectorGroupDeleteArgsSchema = z.object({
  operation: z.literal('delete'),
  id: z.number().optional(),
  groupId: z.number().optional(),
  ids: z.array(z.number()).optional(),
  groups: z.array(z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).strict();

// Combined operation schema with discriminated union
export const CollectorGroupOperationArgsSchema = z.discriminatedUnion('operation', [
  CollectorGroupListArgsSchema,
  CollectorGroupGetArgsSchema,
  CollectorGroupCreateArgsSchema,
  CollectorGroupUpdateArgsSchema,
  CollectorGroupDeleteArgsSchema
]);

// Type exports
export type CollectorGroupListArgs = z.infer<typeof CollectorGroupListArgsSchema>;
export type CollectorGroupGetArgs = z.infer<typeof CollectorGroupGetArgsSchema>;
export type CollectorGroupCreateArgs = z.infer<typeof CollectorGroupCreateArgsSchema>;
export type CollectorGroupUpdateArgs = z.infer<typeof CollectorGroupUpdateArgsSchema>;
export type CollectorGroupDeleteArgs = z.infer<typeof CollectorGroupDeleteArgsSchema>;
export type CollectorGroupOperationArgs = z.infer<typeof CollectorGroupOperationArgsSchema>;

// Validation helper functions
export function validateListCollectorGroups(args: unknown) {
  const result = CollectorGroupListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetCollectorGroup(args: unknown) {
  const result = CollectorGroupGetArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateCreateCollectorGroup(args: unknown) {
  const result = CollectorGroupCreateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateUpdateCollectorGroup(args: unknown) {
  const result = CollectorGroupUpdateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateDeleteCollectorGroup(args: unknown) {
  const result = CollectorGroupDeleteArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

