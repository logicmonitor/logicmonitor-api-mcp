/**
 * Collector Group validation schemas
 */

import Joi from 'joi';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const customPropertySchema = Joi.object({
  name: Joi.string().required(),
  value: Joi.string().required()
});

const singleCollectorGroupSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  autoBalance: Joi.boolean().optional(),
  autoBalanceInstanceCountThreshold: Joi.number().optional(),
  customProperties: Joi.array().items(customPropertySchema).optional()
}).unknown(true);

const singleUpdateCollectorGroupSchema = Joi.object({
  groupId: Joi.number().optional(),
  id: Joi.number().optional(),
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  autoBalance: Joi.boolean().optional(),
  autoBalanceInstanceCountThreshold: Joi.number().optional(),
  customProperties: Joi.array().items(customPropertySchema).optional()
}).unknown(true);

const batchOptionsSchema = Joi.object({
  maxConcurrent: Joi.number().min(1).max(50).optional(),
  continueOnError: Joi.boolean().optional(),
  dryRun: Joi.boolean().optional()
}).optional();

export function validateListCollectorGroups(args: any) {
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

export function validateGetCollectorGroup(args: any) {
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

export function validateCreateCollectorGroup(args: any) {
  const schema = Joi.object({
    operation: Joi.string().valid('create').required(),
    // Single collector group properties
    name: Joi.string().when('groups', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    description: Joi.string().when('groups', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    autoBalance: Joi.boolean().optional(),
    autoBalanceInstanceCountThreshold: Joi.number().optional(),
    customProperties: Joi.array().items(customPropertySchema).optional(),
    // Batch properties
    groups: Joi.array().items(singleCollectorGroupSchema).optional(),
    batchOptions: batchOptionsSchema
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateUpdateCollectorGroup(args: any) {
  const schema = Joi.object({
    operation: Joi.string().valid('update').required(),
    id: Joi.number().optional(),
    groupId: Joi.number().optional(),
    // Update fields
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    autoBalance: Joi.boolean().optional(),
    autoBalanceInstanceCountThreshold: Joi.number().optional(),
    customProperties: Joi.array().items(customPropertySchema).optional(),
    // Batch properties
    groups: Joi.array().items(singleUpdateCollectorGroupSchema).optional(),
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

export function validateDeleteCollectorGroup(args: any) {
  const schema = Joi.object({
    operation: Joi.string().valid('delete').required(),
    id: Joi.number().optional(),
    groupId: Joi.number().optional(),
    ids: Joi.array().items(Joi.number()).optional(),
    groups: Joi.array().items(
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

