/**
 * User Zod validation schemas
 * Migrated from Joi schemas in userSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { portalOverrideSchema } from '../base/portalArgSchema.js';

// Common schemas
const roleSchema = z.object({
  id: z.number().describe('Role ID to assign to the user')
});

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional().describe('Max parallel API requests (default 5)'),
  continueOnError: z.boolean().optional().describe('If true, continue processing remaining items when one fails'),
  dryRun: z.boolean().optional().describe('If true, validate inputs without executing the operation')
}).optional().describe('Options for controlling batch operation behavior');

// Single user create schema — .loose() allows additional LM API fields not explicitly listed
const singleUserSchema = z.object({
  username: z.string().describe('Login username for the user'),
  email: z.string().email().describe('Email address for the user'),
  firstName: z.string().describe('First name of the user'),
  lastName: z.string().describe('Last name of the user'),
  roles: z.array(roleSchema).min(1).describe('Array of role objects (at least one required), e.g. [{"id": 1}]'),
  password: z.string().optional().describe('Password for the user account'),
  phone: z.string().optional().describe('Phone number for the user'),
  smsEmail: z.string().optional().describe('SMS email address for notifications'),
  status: z.string().optional().describe('User account status, e.g. "active" or "suspended"'),
  timezone: z.string().optional().describe('Timezone for the user, e.g. "America/New_York"'),
  note: z.string().optional().describe('Freeform note about the user'),
  apionly: z.boolean().optional().describe('If true, user can only access the API (no portal UI access)'),
  forcePasswordChange: z.boolean().optional().describe('If true, user must change password on next login'),
  contactMethod: z.string().optional().describe('Preferred contact method, e.g. "email" or "smsEmail"')
}).loose();

// Single user update schema — .loose() allows additional LM API fields not explicitly listed
const singleUpdateUserSchema = z.object({
  userId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  id: z.number().optional().describe('User ID (preferred). Alias: userId'),
  username: z.string().optional().describe('Login username for the user'),
  email: z.string().email().optional().describe('Email address for the user'),
  firstName: z.string().optional().describe('First name of the user'),
  lastName: z.string().optional().describe('Last name of the user'),
  roles: z.array(roleSchema).optional().describe('Array of role objects, e.g. [{"id": 1}]'),
  phone: z.string().optional().describe('Phone number for the user'),
  smsEmail: z.string().optional().describe('SMS email address for notifications'),
  timezone: z.string().optional().describe('Timezone for the user, e.g. "America/New_York"'),
  note: z.string().optional().describe('Freeform note about the user'),
  status: z.string().optional().describe('User account status, e.g. "active" or "suspended"'),
  forcePasswordChange: z.boolean().optional().describe('If true, user must change password on next login'),
  contactMethod: z.string().optional().describe('Preferred contact method, e.g. "email" or "smsEmail"')
}).loose();

// List operation schema — .strict() rejects unknown parameters
export const UserListArgsSchema = z.object({
  operation: z.literal('list').describe('The operation to perform'),
  portal: portalOverrideSchema,
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/user for valid field names.'),
  size: z.number().min(1).max(1000).optional().describe('Items per page (default 50, max 1000)'),
  offset: z.number().min(0).optional().describe('Number of items to skip for pagination (default 0)'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"'),
  autoPaginate: z.boolean().optional().describe('When true, automatically fetches all pages. Use cautiously on large result sets.')
}).strict();

// Get operation schema — .strict() rejects unknown parameters
export const UserGetArgsSchema = z.object({
  operation: z.literal('get').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().optional().describe('User ID (preferred). Alias: userId'),
  userId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  fields: z.string().optional().describe('Comma-separated list of fields to return, e.g. "id,displayName"')
}).strict();

// Create operation schema — .strict() rejects unknown parameters
export const UserCreateArgsSchema = z.object({
  operation: z.literal('create').describe('The operation to perform'),
  portal: portalOverrideSchema,
  username: z.string().optional().describe('Login username for the user (required for single create)'),
  email: z.string().email().optional().describe('Email address for the user (required for single create)'),
  firstName: z.string().optional().describe('First name of the user (required for single create)'),
  lastName: z.string().optional().describe('Last name of the user (required for single create)'),
  roles: z.array(roleSchema).optional().describe('Array of role objects (required for single create), e.g. [{"id": 1}]'),
  password: z.string().optional().describe('Password for the user account'),
  phone: z.string().optional().describe('Phone number for the user'),
  smsEmail: z.string().optional().describe('SMS email address for notifications'),
  status: z.string().optional().describe('User account status, e.g. "active" or "suspended"'),
  timezone: z.string().optional().describe('Timezone for the user, e.g. "America/New_York"'),
  note: z.string().optional().describe('Freeform note about the user'),
  apionly: z.boolean().optional().describe('If true, user can only access the API (no portal UI access)'),
  forcePasswordChange: z.boolean().optional().describe('If true, user must change password on next login'),
  contactMethod: z.string().optional().describe('Preferred contact method, e.g. "email" or "smsEmail"'),
  users: z.array(singleUserSchema).optional().describe('Array of user objects for batch creation'),
  batchOptions: batchOptionsSchema
}).strict()
.superRefine((data, ctx) => {
  // If not using users array, require single user fields
  if (!data.users) {
    if (!data.username) {
      ctx.addIssue({
        code: 'custom',
        message: 'username is required when users is not provided',
        path: ['username']
      });
    }
    if (!data.email) {
      ctx.addIssue({
        code: 'custom',
        message: 'email is required when users is not provided',
        path: ['email']
      });
    }
    if (!data.firstName) {
      ctx.addIssue({
        code: 'custom',
        message: 'firstName is required when users is not provided',
        path: ['firstName']
      });
    }
    if (!data.lastName) {
      ctx.addIssue({
        code: 'custom',
        message: 'lastName is required when users is not provided',
        path: ['lastName']
      });
    }
    if (!data.roles) {
      ctx.addIssue({
        code: 'custom',
        message: 'roles is required when users is not provided',
        path: ['roles']
      });
    }
  }
});

// Update operation schema — .strict() rejects unknown parameters
export const UserUpdateArgsSchema = z.object({
  operation: z.literal('update').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().optional().describe('User ID (preferred). Alias: userId'),
  userId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  username: z.string().optional().describe('Login username for the user'),
  email: z.string().email().optional().describe('Email address for the user'),
  firstName: z.string().optional().describe('First name of the user'),
  lastName: z.string().optional().describe('Last name of the user'),
  roles: z.array(roleSchema).optional().describe('Array of role objects, e.g. [{"id": 1}]'),
  phone: z.string().optional().describe('Phone number for the user'),
  smsEmail: z.string().optional().describe('SMS email address for notifications'),
  timezone: z.string().optional().describe('Timezone for the user, e.g. "America/New_York"'),
  note: z.string().optional().describe('Freeform note about the user'),
  status: z.string().optional().describe('User account status, e.g. "active" or "suspended"'),
  forcePasswordChange: z.boolean().optional().describe('If true, user must change password on next login'),
  contactMethod: z.string().optional().describe('Preferred contact method, e.g. "email" or "smsEmail"'),
  users: z.array(singleUpdateUserSchema).optional().describe('Array of user objects for batch update'),
  updates: z.record(z.string(), z.unknown()).optional().describe('Key-value pairs of fields to update across all targeted users'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.'),
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/user for valid field names.'),
  batchOptions: batchOptionsSchema
}).strict();

// Delete operation schema — .strict() rejects unknown parameters
export const UserDeleteArgsSchema = z.object({
  operation: z.literal('delete').describe('The operation to perform'),
  portal: portalOverrideSchema,
  id: z.number().optional().describe('User ID (preferred). Alias: userId'),
  userId: z.number().optional().describe('Alias for id. Prefer using id instead.'),
  ids: z.array(z.number()).optional().describe('Array of user IDs to delete in batch'),
  users: z.array(z.object({
    id: z.number().describe('User ID to delete')
  }).loose()).optional().describe('Array of user objects for batch deletion'),
  applyToPrevious: z.string().optional().describe('Session variable name containing IDs from a prior list, e.g. "lastDeviceListIds". Use lm_session list to see available variables.'),
  filter: z.string().optional().describe('LM filter expression, e.g. "displayName:*prod*". See health://logicmonitor/fields/user for valid field names.'),
  batchOptions: batchOptionsSchema
}).strict();

// Combined operation schema with discriminated union
export const UserOperationArgsSchema = z.discriminatedUnion('operation', [
  UserListArgsSchema,
  UserGetArgsSchema,
  UserCreateArgsSchema,
  UserUpdateArgsSchema,
  UserDeleteArgsSchema
]);

// Type exports
export type UserListArgs = z.infer<typeof UserListArgsSchema>;
export type UserGetArgs = z.infer<typeof UserGetArgsSchema>;
export type UserCreateArgs = z.infer<typeof UserCreateArgsSchema>;
export type UserUpdateArgs = z.infer<typeof UserUpdateArgsSchema>;
export type UserDeleteArgs = z.infer<typeof UserDeleteArgsSchema>;
export type UserOperationArgs = z.infer<typeof UserOperationArgsSchema>;

// Validation helper functions
export function validateListUsers(args: unknown) {
  const result = UserListArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateGetUser(args: unknown) {
  const result = UserGetArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateCreateUser(args: unknown) {
  const result = UserCreateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateUpdateUser(args: unknown) {
  const result = UserUpdateArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}

export function validateDeleteUser(args: unknown) {
  const result = UserDeleteArgsSchema.safeParse(args);
  if (!result.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${result.error.issues.map(e => `${String(e.path.join('.'))}:  ${e.message}`).join(', ')}`
    );
  }
  return result.data;
}
