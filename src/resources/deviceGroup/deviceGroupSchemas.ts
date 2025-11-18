/**
 * Device Group validation schemas
 */

import Joi from 'joi';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const batchOptionsSchema = Joi.object({
  maxConcurrent: Joi.number().min(1).max(50).optional(),
  continueOnError: Joi.boolean().optional(),
  dryRun: Joi.boolean().optional()
}).optional();

export function validateListDeviceGroups(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('list').required(),
    filter: Joi.string().optional(),
    size: Joi.number().min(1).max(1000).optional(),
    offset: Joi.number().min(0).optional(),
    fields: Joi.string().optional(),
    parentId: Joi.number().optional()
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateGetDeviceGroup(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('get').required(),
    id: Joi.number().optional(),
    groupId: Joi.number().optional(),
    fields: Joi.string().optional()
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateCreateDeviceGroup(args: unknown) {
  const singleGroupSchema = Joi.object({
    name: Joi.string().required(),
    parentId: Joi.number().required(),
    description: Joi.string().optional(),
    appliesTo: Joi.string().optional(),
    customProperties: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required()
      })
    ).optional()
  }).unknown(true);

  const schema = Joi.object({
    operation: Joi.string().valid('create').required(),
    name: Joi.string().when('groups', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    parentId: Joi.number().when('groups', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    description: Joi.string().optional(),
    appliesTo: Joi.string().optional(),
    customProperties: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required()
      })
    ).optional(),
    groups: Joi.array().items(singleGroupSchema).min(1).optional(),
    batchOptions: batchOptionsSchema
  }).unknown(true);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateUpdateDeviceGroup(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('update').required(),
    id: Joi.number().optional(),
    groupId: Joi.number().optional(),
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    appliesTo: Joi.string().optional(),
    customProperties: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required()
      })
    ).optional(),
    groups: Joi.array().optional(),
    updates: Joi.object().optional(),
    applyToPrevious: Joi.string().optional(),
    filter: Joi.string().optional(),
    batchOptions: batchOptionsSchema
  }).unknown(true);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateDeleteDeviceGroup(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('delete').required(),
    id: Joi.number().optional(),
    groupId: Joi.number().optional(),
    deleteChildren: Joi.boolean().optional(),
    groups: Joi.array().optional(),
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

