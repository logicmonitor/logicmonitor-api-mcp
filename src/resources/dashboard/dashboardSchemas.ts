/**
 * Dashboard validation schemas
 */

import Joi from 'joi';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const widgetTokenSchema = Joi.object({
  name: Joi.string().required(),
  value: Joi.string().required()
});

const singleDashboardSchema = Joi.object({
  name: Joi.string().required(),
  groupId: Joi.number().required(),
  description: Joi.string().optional(),
  widgetsConfig: Joi.string().optional(),
  widgetTokens: Joi.array().items(widgetTokenSchema).optional(),
  template: Joi.boolean().optional(),
  sharable: Joi.boolean().optional()
}).unknown(true);

const singleUpdateDashboardSchema = Joi.object({
  dashboardId: Joi.number().optional(),
  id: Joi.number().optional(),
  name: Joi.string().optional(),
  groupId: Joi.number().optional(),
  description: Joi.string().optional(),
  widgetsConfig: Joi.string().optional(),
  widgetTokens: Joi.array().items(widgetTokenSchema).optional(),
  template: Joi.boolean().optional(),
  sharable: Joi.boolean().optional()
}).unknown(true);

const batchOptionsSchema = Joi.object({
  maxConcurrent: Joi.number().min(1).max(50).optional(),
  continueOnError: Joi.boolean().optional(),
  dryRun: Joi.boolean().optional()
}).optional();

export function validateListDashboards(args: unknown) {
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

export function validateGetDashboard(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('get').required(),
    id: Joi.number().optional(),
    dashboardId: Joi.number().optional(),
    fields: Joi.string().optional()
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateCreateDashboard(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('create').required(),
    // Single dashboard properties
    name: Joi.string().when('dashboards', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    groupId: Joi.number().when('dashboards', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    description: Joi.string().optional(),
    widgetsConfig: Joi.string().optional(),
    widgetTokens: Joi.array().items(widgetTokenSchema).optional(),
    template: Joi.boolean().optional(),
    sharable: Joi.boolean().optional(),
    // Batch properties
    dashboards: Joi.array().items(singleDashboardSchema).optional(),
    batchOptions: batchOptionsSchema
  }).unknown(false);

  const { error, value } = schema.validate(args);
  if (error) {
    throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
  }
  return value;
}

export function validateUpdateDashboard(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('update').required(),
    id: Joi.number().optional(),
    dashboardId: Joi.number().optional(),
    // Update fields
    name: Joi.string().optional(),
    groupId: Joi.number().optional(),
    description: Joi.string().optional(),
    widgetsConfig: Joi.string().optional(),
    widgetTokens: Joi.array().items(widgetTokenSchema).optional(),
    template: Joi.boolean().optional(),
    sharable: Joi.boolean().optional(),
    // Batch properties
    dashboards: Joi.array().items(singleUpdateDashboardSchema).optional(),
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

export function validateDeleteDashboard(args: unknown) {
  const schema = Joi.object({
    operation: Joi.string().valid('delete').required(),
    id: Joi.number().optional(),
    dashboardId: Joi.number().optional(),
    ids: Joi.array().items(Joi.number()).optional(),
    dashboards: Joi.array().items(
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

