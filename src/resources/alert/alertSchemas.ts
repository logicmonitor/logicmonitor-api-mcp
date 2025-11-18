/**
 * Alert validation schemas
 */

import Joi from 'joi';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export function validateListAlerts(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('list').required(),
    filter: Joi.string().optional(),
    fields: Joi.string().optional(),
    size: Joi.number().min(1).max(1000).optional(),
    offset: Joi.number().min(0).optional(),
    sort: Joi.string().optional(),
    needMessage: Joi.boolean().optional(),
    customColumns: Joi.string().optional()
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateGetAlert(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('get').required(),
    id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    alertId: Joi.alternatives().try(Joi.string(), Joi.number()).optional()
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateUpdateAlert(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('update').required(),
    id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    alertId: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    action: Joi.string().valid('ack', 'note', 'escalate').required(),
    ackComment: Joi.string().when('action', {
      is: 'ack',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    note: Joi.string().when('action', {
      is: 'note',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

