/**
 * Collector validation schemas
 */

import Joi from 'joi';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export function validateListCollectors(args: any) {
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

