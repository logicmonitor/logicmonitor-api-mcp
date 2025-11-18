/**
 * User validation schemas
 */

import Joi from 'joi';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const roleSchema = Joi.object({
  id: Joi.number().required()
});

const singleUserSchema = Joi.object({
  username: Joi.string().required(),
  email: Joi.string().email().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  roles: Joi.array().items(roleSchema).min(1).required(),
  password: Joi.string().optional(),
  phone: Joi.string().optional(),
  smsEmail: Joi.string().optional(),
  timezone: Joi.string().optional(),
  note: Joi.string().optional(),
  apionly: Joi.boolean().optional(),
  forcePasswordChange: Joi.boolean().optional(),
  contactMethod: Joi.string().optional()
}).unknown(true);

const singleUpdateUserSchema = Joi.object({
  userId: Joi.number().optional(),
  id: Joi.number().optional(),
  username: Joi.string().optional(),
  email: Joi.string().email().optional(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  roles: Joi.array().items(roleSchema).optional(),
  phone: Joi.string().optional(),
  smsEmail: Joi.string().optional(),
  timezone: Joi.string().optional(),
  note: Joi.string().optional(),
  status: Joi.string().optional(),
  forcePasswordChange: Joi.boolean().optional(),
  contactMethod: Joi.string().optional()
}).unknown(true);

const batchOptionsSchema = Joi.object({
  maxConcurrent: Joi.number().min(1).max(50).optional(),
  continueOnError: Joi.boolean().optional(),
  dryRun: Joi.boolean().optional()
}).optional();

export function validateListUsers(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('list').required(),
    filter: Joi.string().optional(),
    size: Joi.number().min(1).max(1000).optional(),
    offset: Joi.number().min(0).optional(),
    fields: Joi.string().optional()
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateGetUser(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('get').required(),
    id: Joi.number().optional(),
    userId: Joi.number().optional(),
    fields: Joi.string().optional()
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateCreateUser(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('create').required(),
    // Single user properties
    username: Joi.string().when('users', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    email: Joi.string().email().when('users', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    firstName: Joi.string().when('users', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    lastName: Joi.string().when('users', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    roles: Joi.array().items(roleSchema).when('users', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    password: Joi.string().optional(),
    phone: Joi.string().optional(),
    smsEmail: Joi.string().optional(),
    timezone: Joi.string().optional(),
    note: Joi.string().optional(),
    apionly: Joi.boolean().optional(),
    forcePasswordChange: Joi.boolean().optional(),
    contactMethod: Joi.string().optional(),
    // Batch properties
    users: Joi.array().items(singleUserSchema).optional(),
    batchOptions: batchOptionsSchema
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateUpdateUser(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('update').required(),
    id: Joi.number().optional(),
    userId: Joi.number().optional(),
    // Update fields
    username: Joi.string().optional(),
    email: Joi.string().email().optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    roles: Joi.array().items(roleSchema).optional(),
    phone: Joi.string().optional(),
    smsEmail: Joi.string().optional(),
    timezone: Joi.string().optional(),
    note: Joi.string().optional(),
    status: Joi.string().optional(),
    forcePasswordChange: Joi.boolean().optional(),
    contactMethod: Joi.string().optional(),
    // Batch properties
    users: Joi.array().items(singleUpdateUserSchema).optional(),
    updates: Joi.object().optional(),
    applyToPrevious: Joi.string().optional(),
    filter: Joi.string().optional(),
    batchOptions: batchOptionsSchema
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateDeleteUser(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('delete').required(),
    id: Joi.number().optional(),
    userId: Joi.number().optional(),
    ids: Joi.array().items(Joi.number()).optional(),
    users: Joi.array().items(
      Joi.object({
        id: Joi.number().required()
      }).unknown(true)
    ).optional(),
    applyToPrevious: Joi.string().optional(),
    filter: Joi.string().optional(),
    batchOptions: batchOptionsSchema
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

