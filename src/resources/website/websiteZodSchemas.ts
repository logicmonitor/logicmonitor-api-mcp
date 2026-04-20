/**
 * Website Zod validation schemas
 * Migrated from Joi schemas in websiteSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// Common schemas
const propertySchema = z.object({
  name: z.string().describe('Property name'),
  value: z.string().describe('Property value')
});

// Step schema — .loose() allows additional LM API fields not explicitly listed
const stepSchema = z.object({
  type: z.string().describe('Step type, e.g. "config" or "navigate"').optional(),
  name: z.string().describe('Display name of this step').optional(),
  description: z.string().describe('Description of what this step does').optional(),
  enable: z.boolean().describe('If true, this step is active').optional(),
  label: z.string().describe('Label for this step').optional(),
  HTTPHeaders: z.string().describe('HTTP headers to send, formatted as "Header1:Value1\\nHeader2:Value2"').optional(),
  followRedirection: z.boolean().describe('If true, automatically follow HTTP redirects').optional(),
  HTTPBody: z.string().describe('HTTP request body content').optional(),
  HTTPMethod: z.string().describe('HTTP method: GET, POST, PUT, DELETE, PATCH, HEAD').optional(),
  postDataEditType: z.unknown().describe('Post data edit type for the request body').optional(),
  fullpageLoad: z.boolean().describe('If true, wait for full page load before evaluating results').optional(),
  requireAuth: z.boolean().describe('If true, authentication is required for this step').optional(),
  auth: z.unknown().describe('Authentication configuration object for this step').optional(),
  timeout: z.number().describe('Timeout in milliseconds for this step').optional(),
  HTTPVersion: z.string().describe('HTTP version to use, e.g. "1.1" or "2"').optional(),
  schema: z.string().describe('Expected response schema, e.g. "http" or "https"').optional(),
  url: z.string().describe('URL path for this step (appended to the website domain)').optional(),
  matchType: z.string().describe('Response match type: "plain", "regex", "json", or "glob"').optional(),
  keyword: z.string().describe('Keyword or pattern to match in the response body').optional(),
  path: z.string().describe('JSON path or XPath expression for response validation').optional(),
  invertMatch: z.boolean().describe('If true, the step succeeds when the keyword is NOT found').optional(),
  statusCode: z.string().describe('Expected HTTP status code, e.g. "200" or "200,301"').optional(),
  reqScript: z.string().describe('Pre-request script to execute before this step').optional(),
  reqType: z.string().describe('Request content type, e.g. "application/json"').optional(),
  respType: z.string().describe('Expected response content type').optional(),
  respScript: z.string().describe('Post-response script to execute after this step').optional(),
  useDefaultRoot: z.boolean().describe('If true, use the default root certificate store').optional()
}).loose();

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).describe('Max parallel API requests (default 5)').optional(),
  continueOnError: z.boolean().describe('If true, continue processing remaining items when one fails').optional(),
  dryRun: z.boolean().describe('If true, validate inputs without executing the operation').optional()
}).describe('Options for controlling batch execution behavior').optional();

// Single website create schema — .loose() allows additional LM API fields not explicitly listed
const singleWebsiteSchema = z.object({
  name: z.string().describe('Display name of the website monitor'),
  domain: z.string().describe('Domain or IP to monitor, e.g. "www.example.com"'),
  type: z.enum(['webcheck', 'pingcheck']).describe('Monitor type: "webcheck" for HTTP checks, "pingcheck" for ICMP ping'),
  groupId: z.number().describe('Website group ID to place this monitor in'),
  description: z.string().describe('Description of this website monitor').optional(),
  disableAlerting: z.boolean().describe('If true, suppress alerts for this website').optional(),
  stopMonitoring: z.boolean().describe('If true, pause monitoring for this website').optional(),
  useDefaultAlertSetting: z.boolean().describe('If true, inherit alert settings from the parent group').optional(),
  useDefaultLocationSetting: z.boolean().describe('If true, inherit checkpoint locations from the parent group').optional(),
  pollingInterval: z.number().describe('Monitoring poll interval in minutes (e.g. 1, 2, 3, 5, 10)').optional(),
  properties: z.array(propertySchema).describe('Properties (key-value pairs) for this website').optional(),
  steps: z.array(stepSchema).describe('Ordered list of web check steps (for webcheck type only)').optional()
}).loose();

// List operation schema — .strict() rejects unknown parameters
export const WebsiteListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/website for valid field names.').optional(),
  size: z.number().min(1).max(1000).describe('Items per page (default 50, max 1000)').optional(),
  offset: z.number().min(0).describe('Number of items to skip for pagination (default 0)').optional(),
  fields: z.string().describe('Comma-separated list of fields to return, e.g. "id,displayName"').optional(),
  autoPaginate: z.boolean().describe('When true, automatically fetches all pages. Use cautiously on large result sets.').optional(),
  collectorIds: z.string().describe('Comma-separated collector IDs to filter websites by assigned collector').optional()
}).strict();

// Get operation schema — .strict() rejects unknown parameters
export const WebsiteGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Website ID (preferred). Alias: websiteId').optional(),
  websiteId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  fields: z.string().describe('Comma-separated list of fields to return, e.g. "id,displayName"').optional()
}).strict();

// Create operation schema — .loose() allows additional LM API fields not explicitly listed
export const WebsiteCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  name: z.string().describe('Display name of the website monitor. Required for single create.').optional(),
  domain: z.string().describe('Domain or IP to monitor, e.g. "www.example.com". Required for single create.').optional(),
  type: z.enum(['webcheck', 'pingcheck']).describe('Monitor type: "webcheck" for HTTP checks, "pingcheck" for ICMP ping. Required for single create.').optional(),
  groupId: z.number().describe('Website group ID to place this monitor in. Required for single create.').optional(),
  description: z.string().describe('Description of this website monitor').optional(),
  disableAlerting: z.boolean().describe('If true, suppress alerts for this website').optional(),
  stopMonitoring: z.boolean().describe('If true, pause monitoring for this website').optional(),
  useDefaultAlertSetting: z.boolean().describe('If true, inherit alert settings from the parent group').optional(),
  useDefaultLocationSetting: z.boolean().describe('If true, inherit checkpoint locations from the parent group').optional(),
  pollingInterval: z.number().describe('Monitoring poll interval in minutes (e.g. 1, 2, 3, 5, 10)').optional(),
  properties: z.array(propertySchema).describe('Properties (key-value pairs) for this website').optional(),
  steps: z.array(stepSchema).describe('Ordered list of web check steps (for webcheck type only)').optional(),
  websites: z.array(singleWebsiteSchema).min(1).describe('Array of website objects for batch create. Mutually exclusive with name/domain/type/groupId.').optional(),
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

// Update operation schema — .loose() allows additional LM API fields not explicitly listed
export const WebsiteUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Website ID to update (preferred). Alias: websiteId').optional(),
  websiteId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  name: z.string().describe('New display name for the website monitor').optional(),
  description: z.string().describe('New description for the website monitor').optional(),
  disableAlerting: z.boolean().describe('If true, suppress alerts for this website').optional(),
  stopMonitoring: z.boolean().describe('If true, pause monitoring for this website').optional(),
  useDefaultAlertSetting: z.boolean().describe('If true, inherit alert settings from the parent group').optional(),
  useDefaultLocationSetting: z.boolean().describe('If true, inherit checkpoint locations from the parent group').optional(),
  pollingInterval: z.number().describe('Monitoring poll interval in minutes (e.g. 1, 2, 3, 5, 10)').optional(),
  properties: z.array(propertySchema).describe('Properties to set on this website').optional(),
  websites: z.array(z.object({
    id: z.number().describe('Website ID (preferred). Alias: websiteId').optional(),
    websiteId: z.number().describe('Alias for id. Prefer using id instead.').optional()
  }).passthrough()).min(1).describe('Array of website objects for batch update, each with its own id and fields to change').optional(),
  updates: z.record(z.string(), z.unknown()).describe('Key-value map of fields to update, applied to the target website(s)').optional(),
  applyToPrevious: z.string().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.').optional(),
  filter: z.string().describe('Apply this update to all websites matching the LM filter expression').optional(),
  batchOptions: batchOptionsSchema
}).loose();

// Delete operation schema — .strict() rejects unknown parameters
export const WebsiteDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().describe('Website ID to delete (preferred). Alias: websiteId').optional(),
  websiteId: z.number().describe('Alias for id. Prefer using id instead.').optional(),
  websites: z.array(z.object({
    id: z.number().describe('Website ID (preferred). Alias: websiteId').optional(),
    websiteId: z.number().describe('Alias for id. Prefer using id instead.').optional()
  }).passthrough()).min(1).describe('Array of website objects with IDs for batch delete').optional(),
  applyToPrevious: z.string().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.').optional(),
  filter: z.string().describe('Delete all websites matching this LM filter expression').optional(),
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
