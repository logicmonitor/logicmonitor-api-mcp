/**
 * Device validation schemas
 */

import Joi from 'joi';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const singleDeviceSchema = Joi.object({
  displayName: Joi.string().required(),
  name: Joi.string().required(),
  hostGroupIds: Joi.array().items(Joi.number()).min(1).required(),
  preferredCollectorId: Joi.number().required(),
  disableAlerting: Joi.boolean().optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional(),
  customProperties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional()
}).unknown(true);

const singleUpdateDeviceSchema = Joi.object({
  deviceId: Joi.number().optional(),
  id: Joi.number().optional(),
  displayName: Joi.string().optional(),
  hostGroupIds: Joi.array().items(Joi.number()).optional(),
  disableAlerting: Joi.boolean().optional(),
  customProperties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional()
}).unknown(true);

const batchOptionsSchema = Joi.object({
  maxConcurrent: Joi.number().min(1).max(50).optional(),
  continueOnError: Joi.boolean().optional(),
  dryRun: Joi.boolean().optional()
}).optional();

export function validateListDevices(args: any) {
  const schema = Joi.object({
    operation: Joi.string().valid('list').required(),
    filter: Joi.string().optional(),
    size: Joi.number().min(1).max(1000).optional(),
    offset: Joi.number().min(0).optional(),
    fields: Joi.string().optional(),
    start: Joi.number().optional(),
    end: Joi.number().optional(),
    netflowFilter: Joi.string().optional(),
    includeDeletedResources: Joi.boolean().optional()
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateGetDevice(args: any) {
  const schema = Joi.object({
    operation: Joi.string().valid('get').required(),
    id: Joi.number().optional(),
    deviceId: Joi.number().optional(),
    fields: Joi.string().optional(),
    start: Joi.number().optional(),
    end: Joi.number().optional(),
    netflowFilter: Joi.string().optional(),
    needStcGrpAndSortedCP: Joi.boolean().optional()
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateCreateDevice(args: any) {
  const schema = Joi.object({
    operation: Joi.string().valid('create').required(),
    // Single device properties
    displayName: Joi.string().when('devices', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    name: Joi.string().when('devices', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    hostGroupIds: Joi.array().items(Joi.number()).min(1).when('devices', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    preferredCollectorId: Joi.number().when('devices', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    disableAlerting: Joi.boolean().optional(),
    properties: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required()
      }).unknown(true)
    ).optional(),
    customProperties: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required()
      }).unknown(true)
    ).optional(),
    // Batch properties
    devices: Joi.array().items(singleDeviceSchema).min(1).optional(),
    batchOptions: batchOptionsSchema
  }).xor('displayName', 'devices').unknown(true);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateUpdateDevice(args: any) {
  const schema = Joi.object({
    operation: Joi.string().valid('update').required(),
    // Single device update
    id: Joi.number().optional(),
    deviceId: Joi.number().optional(),
    displayName: Joi.string().optional(),
    hostGroupIds: Joi.array().items(Joi.number()).optional(),
    disableAlerting: Joi.boolean().optional(),
    customProperties: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required()
      })
    ).optional(),
    properties: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required()
      })
    ).optional(),
    // Batch update properties
    devices: Joi.array().items(singleUpdateDeviceSchema).min(1).optional(),
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

export function validateDeleteDevice(args: any) {
  const schema = Joi.object({
    operation: Joi.string().valid('delete').required(),
    id: Joi.number().optional(),
    deviceId: Joi.number().optional(),
    ids: Joi.array().items(Joi.number()).optional(),
    devices: Joi.array().items(
      Joi.object({
        deviceId: Joi.number().optional(),
        id: Joi.number().optional()
      }).unknown(false)
    ).min(1).optional(),
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

