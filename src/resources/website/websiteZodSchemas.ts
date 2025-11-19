/**
 * Website Zod validation schemas
 * Migrated from Joi schemas in websiteSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@socotra/modelcontextprotocol-sdk/types.js';

// Common schemas
const propertySchema = z.object({
  name: z.string(),
  value: z.string()
});

const stepSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  enable: z.boolean().optional(),
  label: z.string().optional(),
  HTTPHeaders: z.string().optional(),
  followRedirection: z.boolean().optional(),
  HTTPBody: z.string().optional(),
  HTTPMethod: z.string().optional(),
  postDataEditType: z.any().optional(),
  fullpageLoad: z.boolean().optional(),
  requireAuth: z.boolean().optional(),
  auth: z.any().optional(),
  timeout: z.number().optional(),
  HTTPVersion: z.string().optional(),
  schema: z.string().optional(),
  url: z.string().optional(),
  matchType: z.string().optional(),
  keyword: z.string().optional(),
  path: z.string().optional(),
  invertMatch: z.boolean().optional(),
  statusCode: z.string().optional(),
  reqScript: z.string().optional(),
  reqType: z.string().optional(),
  respType: z.string().optional(),
  respScript: z.string().optional(),
  useDefaultRoot: z.boolean().optional()
}).loose();

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional(),
  continueOnError: z.boolean().optional(),
  dryRun: z.boolean().optional()
}).optional();

// Single website create schema
const singleWebsiteSchema = z.object({
  name: z.string(),
  domain: z.string(),
  type: z.enum(['webcheck', 'pingcheck']),
  groupId: z.number(),
  description: z.string().optional(),
  disableAlerting: z.boolean().optional(),
  stopMonitoring: z.boolean().optional(),
  useDefaultAlertSetting: z.boolean().optional(),
  useDefaultLocationSetting: z.boolean().optional(),
  pollingInterval: z.number().optional(),
  properties: z.array(propertySchema).optional(),
  steps: z.array(stepSchema).optional()
}).loose();

// List operation schema
export const WebsiteListArgsSchema = z.object({
  operation: z.literal('list'),
  filter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional(),
  collectorIds: z.string().optional()
}).strict();

// Get operation schema
export const WebsiteGetArgsSchema = z.object({
  operation: z.literal('get'),
  id: z.number().optional(),
  websiteId: z.number().optional(),
  fields: z.string().optional()
}).strict();

// Create operation schema
export const WebsiteCreateArgsSchema = z.object({
  operation: z.literal('create'),
  name: z.string().optional(),
  domain: z.string().optional(),
  type: z.enum(['webcheck', 'pingcheck']).optional(),
  groupId: z.number().optional(),
  description: z.string().optional(),
  disableAlerting: z.boolean().optional(),
  stopMonitoring: z.boolean().optional(),
  useDefaultAlertSetting: z.boolean().optional(),
  useDefaultLocationSetting: z.boolean().optional(),
  pollingInterval: z.number().optional(),
  properties: z.array(propertySchema).optional(),
  steps: z.array(stepSchema).optional(),
  websites: z.array(singleWebsiteSchema).min(1).optional(),
  batchOptions: batchOptionsSchema
}).loose()
.superRefine((data, ctx) => {
  // If not using websites array, require single website fields
  if (!data.websites) {
    if (!data.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'name is required when websites is not provided',
        path: ['name']
      });
    }
    if (!data.domain) {
      ctx.addIssue({
        code: 'custom',
        message: 'domain is required when websites is not provided',
        path: ['domain']
      });
    }
    if (!data.type) {
      ctx.addIssue({
        code: 'custom',
        message: 'type is required when websites is not provided',
        path: ['type']
      });
    }
    if (!data.groupId) {
      ctx.addIssue({
        code: 'custom',
        message: 'groupId is required when websites is not provided',
        path: ['groupId']
      });
    }
  }
});

// Update operation schema
export const WebsiteUpdateArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.number().optional(),
  websiteId: z.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  disableAlerting: z.boolean().optional(),
  stopMonitoring: z.boolean().optional(),
  useDefaultAlertSetting: z.boolean().optional(),
  useDefaultLocationSetting: z.boolean().optional(),
  pollingInterval: z.number().optional(),
  properties: z.array(propertySchema).optional(),
  websites: z.array(z.any()).optional(),
  updates: z.record(z.string(), z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema
export const WebsiteDeleteArgsSchema = z.object({
  operation: z.literal('delete'),
  id: z.number().optional(),
  websiteId: z.number().optional(),
  websites: z.array(z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).strict();

// Combined operation schema with discriminated union
export const WebsiteOperationArgsSchema = z.discriminatedUnion('operation', [
  WebsiteListArgsSchema,
  WebsiteGetArgsSchema,
  WebsiteCreateArgsSchema,
  WebsiteUpdateArgsSchema,
  WebsiteDeleteArgsSchema
]);

// Type exports
export type WebsiteListArgs = z.infer<typeof WebsiteListArgsSchema>;
export type WebsiteGetArgs = z.infer<typeof WebsiteGetArgsSchema>;
export type WebsiteCreateArgs = z.infer<typeof WebsiteCreateArgsSchema>;
export type WebsiteUpdateArgs = z.infer<typeof WebsiteUpdateArgsSchema>;
export type WebsiteDeleteArgs = z.infer<typeof WebsiteDeleteArgsSchema>;
export type WebsiteOperationArgs = z.infer<typeof WebsiteOperationArgsSchema>;

// Validation helper functions
export function validateListWebsites(args: unknown) {
  const result = WebsiteListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetWebsite(args: unknown) {
  const result = WebsiteGetArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateCreateWebsite(args: unknown) {
  const result = WebsiteCreateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateUpdateWebsite(args: unknown) {
  const result = WebsiteUpdateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateDeleteWebsite(args: unknown) {
  const result = WebsiteDeleteArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

