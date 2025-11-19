/**
 * User Zod validation schemas
 * Migrated from Joi schemas in userSchemas.ts
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@socotra/modelcontextprotocol-sdk/types.js';

// Common schemas
const roleSchema = z.object({
  id: z.number()
});

const batchOptionsSchema = z.object({
  maxConcurrent: z.number().min(1).max(50).optional(),
  continueOnError: z.boolean().optional(),
  dryRun: z.boolean().optional()
}).optional();

// Single user create schema
const singleUserSchema = z.object({
  username: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(roleSchema).min(1),
  password: z.string().optional(),
  phone: z.string().optional(),
  smsEmail: z.string().optional(),
  status: z.string().optional(),
  timezone: z.string().optional(),
  note: z.string().optional(),
  apionly: z.boolean().optional(),
  forcePasswordChange: z.boolean().optional(),
  contactMethod: z.string().optional()
}).loose();

// Single user update schema
const singleUpdateUserSchema = z.object({
  userId: z.number().optional(),
  id: z.number().optional(),
  username: z.string().optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  roles: z.array(roleSchema).optional(),
  phone: z.string().optional(),
  smsEmail: z.string().optional(),
  timezone: z.string().optional(),
  note: z.string().optional(),
  status: z.string().optional(),
  forcePasswordChange: z.boolean().optional(),
  contactMethod: z.string().optional()
}).loose();

// List operation schema
export const UserListArgsSchema = z.object({
  operation: z.literal('list'),
  filter: z.string().optional(),
  size: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  fields: z.string().optional(),
  autoPaginate: z.boolean().optional()
}).strict();

// Get operation schema
export const UserGetArgsSchema = z.object({
  operation: z.literal('get'),
  id: z.number().optional(),
  userId: z.number().optional(),
  fields: z.string().optional()
}).strict();

// Create operation schema
export const UserCreateArgsSchema = z.object({
  operation: z.literal('create'),
  username: z.string().optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  roles: z.array(roleSchema).optional(),
  password: z.string().optional(),
  phone: z.string().optional(),
  smsEmail: z.string().optional(),
  status: z.string().optional(),
  timezone: z.string().optional(),
  note: z.string().optional(),
  apionly: z.boolean().optional(),
  forcePasswordChange: z.boolean().optional(),
  contactMethod: z.string().optional(),
  users: z.array(singleUserSchema).optional(),
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

// Update operation schema
export const UserUpdateArgsSchema = z.object({
  operation: z.literal('update'),
  id: z.number().optional(),
  userId: z.number().optional(),
  username: z.string().optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  roles: z.array(roleSchema).optional(),
  phone: z.string().optional(),
  smsEmail: z.string().optional(),
  timezone: z.string().optional(),
  note: z.string().optional(),
  status: z.string().optional(),
  forcePasswordChange: z.boolean().optional(),
  contactMethod: z.string().optional(),
  users: z.array(singleUpdateUserSchema).optional(),
  updates: z.record(z.string(), z.any()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
  batchOptions: batchOptionsSchema
}).strict();

// Delete operation schema
export const UserDeleteArgsSchema = z.object({
  operation: z.literal('delete'),
  id: z.number().optional(),
  userId: z.number().optional(),
  ids: z.array(z.number()).optional(),
  users: z.array(z.object({
    id: z.number()
  }).loose()).optional(),
  applyToPrevious: z.string().optional(),
  filter: z.string().optional(),
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

