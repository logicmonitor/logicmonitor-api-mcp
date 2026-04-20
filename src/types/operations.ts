/**
 * Operation types and enums for resource handlers
 */

export type ResourceType = 'device' | 'deviceGroup' | 'website' | 'websiteGroup' | 'collector' | 'alert' | 'user' | 'dashboard' | 'collectorGroup' | 'deviceData' | 'session' | 'sdt' | 'opsnote';

export type OperationType = 'list' | 'get' | 'create' | 'update' | 'delete' | 'list_datasources' | 'list_instances' | 'get_data';

export interface BaseOperationArgs {
  operation: OperationType;
  portal?: string;
  [key: string]: unknown;
}

export interface ListOperationArgs extends BaseOperationArgs {
  operation: 'list';
  filter?: string;
  size?: number;
  offset?: number;
  fields?: string;
  autoPaginate?: boolean;
}

export interface GetOperationArgs extends BaseOperationArgs {
  operation: 'get';
  id?: number | string;
  fields?: string;
}

export interface CreateOperationArgs extends BaseOperationArgs {
  operation: 'create';
  items?: unknown[];
  batchOptions?: BatchOptions;
}

export interface UpdateOperationArgs extends BaseOperationArgs {
  operation: 'update';
  id?: number | string;
  items?: unknown[];
  updates?: Record<string, unknown>;
  applyToPrevious?: string;
  filter?: string;
  batchOptions?: BatchOptions;
}

export interface DeleteOperationArgs extends BaseOperationArgs {
  operation: 'delete';
  id?: number | string;
  ids?: Array<number | string>;
  items?: unknown[];
  applyToPrevious?: string;
  filter?: string;
  batchOptions?: BatchOptions;
}

export interface BatchOptions {
  maxConcurrent?: number;
  continueOnError?: boolean;
  dryRun?: boolean;
}

export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  items?: T[];
  total?: number;
  meta?: unknown;
  raw?: unknown;
  request?: Record<string, unknown>;
  summary?: {
    total: number;
    succeeded: number;
    failed: number;
  };
  results?: Array<{
    index: number;
    success: boolean;
    data?: T;
    error?: string;
    diagnostics?: unknown;
    meta?: unknown;
    raw?: unknown;
  }>;
}
