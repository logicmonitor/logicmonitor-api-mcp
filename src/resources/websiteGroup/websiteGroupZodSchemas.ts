/**
 * Website Group Zod validation schemas
 * Migrated from Joi schemas in websiteGroupSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

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
  parentId: z.number(),
  description: z.string().optional(),
  disableAlerting: z.boolean().optional(),
  stopMonitoring: z.boolean().optional(),
  properties: z.array(propertySchema).optional()
}).loose();

// List operation schema
export const WebsiteGroupListArgsSchema = z.object({
  operation: z.literal('list'),
  filter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional()
}).strict();

// Get operation schema
export const WebsiteGroupGetArgsSchema = z.object({
  operation: z.literal('get'),
  id: z.number().optional(),
  groupId: z.number().optional(),
  fields: z.string().optional()
}).strict();

// Create operation schema
export const WebsiteGroupCreateArgsSchema = z.object({
  operation: z.literal('create'),
  name: z.string().optional(),
  parentId: z.number().optional(),
  description: z.string().optional(),
  disableAlerting: z.boolean().optional(),
  stopMonitoring: z.boolean().optional(),
  properties: z.array(propertySchema).optional(),
  groups: z.array(singleGroupSchema).min(1).optional(),
  batchOptions: batchOptionsSchema
}).loose()
.superRefine((data, ctx) => {
  // If not using groups array, require single group fields
  if (!data.groups) {
    if (!data.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'name is required when groups is not provided',
        path: ['name']
      });
    }
    if (!data.parentId) {
      ctx.addIssue({
        code: 'custom',
        message: 'parentId is required when groups is not provided',
        path: ['parentId']
      });
    }
  }
});

// Update operation schema
export const WebsiteGroupUpdateArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.number().optional(),
  groupId: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  disableAlerting: z.boolean().optional(),
  stopMonitoring: z.boolean().optional(),
  properties: z.array(propertySchema).optional(),
  groups: z.array(z.any()).optional(),
  updates: z.record(z.string(), z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema
export const WebsiteGroupDeleteArgsSchema = z.object({
  operation: z.literal('delete'),
  id: z.number().optional(),
  groupId: z.number().optional(),
  deleteChildren: z.boolean().optional(),
  groups: z.array(z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).strict();

// Combined operation schema with discriminated union
export const WebsiteGroupOperationArgsSchema = z.discriminatedUnion('operation', [
  WebsiteGroupListArgsSchema,
  WebsiteGroupGetArgsSchema,
  WebsiteGroupCreateArgsSchema,
  WebsiteGroupUpdateArgsSchema,
  WebsiteGroupDeleteArgsSchema
]);

// Type exports
export type WebsiteGroupListArgs = z.infer<typeof WebsiteGroupListArgsSchema>;
export type WebsiteGroupGetArgs = z.infer<typeof WebsiteGroupGetArgsSchema>;
export type WebsiteGroupCreateArgs = z.infer<typeof WebsiteGroupCreateArgsSchema>;
export type WebsiteGroupUpdateArgs = z.infer<typeof WebsiteGroupUpdateArgsSchema>;
export type WebsiteGroupDeleteArgs = z.infer<typeof WebsiteGroupDeleteArgsSchema>;
export type WebsiteGroupOperationArgs = z.infer<typeof WebsiteGroupOperationArgsSchema>;

// Validation helper functions
export function validateListWebsiteGroups(args: unknown) {
  const result = WebsiteGroupListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetWebsiteGroup(args: unknown) {
  const result = WebsiteGroupGetArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateCreateWebsiteGroup(args: unknown) {
  const result = WebsiteGroupCreateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateUpdateWebsiteGroup(args: unknown) {
  const result = WebsiteGroupUpdateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateDeleteWebsiteGroup(args: unknown) {
  const result = WebsiteGroupDeleteArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

