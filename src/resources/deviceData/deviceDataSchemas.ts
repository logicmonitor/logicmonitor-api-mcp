/**
 * Device data validation schemas for datasources, instances, and metric data
 */

import Joi from 'joi';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const batchOptionsSchema = Joi.object({
  maxConcurrent: Joi.number().min(1).max(50).optional(),
  continueOnError: Joi.boolean().optional(),
  dryRun: Joi.boolean().optional()
}).optional();

/**
 * Validate list_datasources operation
 */
export function validateListDatasources(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('list_datasources').required(),
    deviceId: Joi.number().when('deviceIds', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.when('applyToPrevious', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.when('filter', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required()
        })
      })
    }),
    deviceIds: Joi.array().items(Joi.number()).optional(),
    filter: Joi.string().optional(),
    datasourceIncludeFilter: Joi.string().optional(),
    datasourceExcludeFilter: Joi.string().optional(),
    size: Joi.number().min(1).max(1000).optional(),
    offset: Joi.number().min(0).optional(),
    fields: Joi.string().optional(),
    applyToPrevious: Joi.string().optional(),
    batchOptions: batchOptionsSchema
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

/**
 * Validate list_instances operation
 */
export function validateListInstances(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('list_instances').required(),
    deviceId: Joi.number().required(),
    datasourceId: Joi.number().when('datasourceIds', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.when('applyToPrevious', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.when('filter', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required()
        })
      })
    }),
    datasourceIds: Joi.array().items(Joi.number()).optional(),
    datasourceName: Joi.string().optional(),
    filter: Joi.string().optional(),
    size: Joi.number().min(1).max(1000).optional(),
    offset: Joi.number().min(0).optional(),
    fields: Joi.string().optional(),
    applyToPrevious: Joi.string().optional(),
    batchOptions: batchOptionsSchema
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

/**
 * Validate get_data operation
 */
export function validateGetData(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('get_data').required(),
    deviceId: Joi.number().required(),
    datasourceId: Joi.number().required(),
    instanceId: Joi.number().when('instanceIds', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.when('applyToPrevious', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.when('filter', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required()
        })
      })
    }),
    instanceIds: Joi.array().items(Joi.number()).optional(),
    instanceName: Joi.string().optional(),
    startDate: Joi.string().isoDate().optional(),
    endDate: Joi.string().isoDate().optional(),
    start: Joi.number().optional(),
    end: Joi.number().optional(),
    datapoints: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
    format: Joi.string().optional(),
    aggregate: Joi.string().optional(),
    filter: Joi.string().optional(),
    applyToPrevious: Joi.string().optional(),
    batchOptions: batchOptionsSchema
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

