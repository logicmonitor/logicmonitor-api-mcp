/**
 * Batch Processing Utility
 * 
 * Handles batch operations with:
 * - Configurable concurrency control
 * - Rate limit awareness
 * - Partial failure handling
 * - Progress tracking
 */

import { rateLimiter, RateLimiter } from './rateLimiter.js';
import { LogicMonitorApiError } from '../api/errors.js';
import type { LogicMonitorResponseMeta } from '../api/client.js';

export interface BatchItem<T> {
  index: number;
  success: boolean;
  data?: T;
  error?: string;
  diagnostics?: BatchDiagnostics;
  meta?: LogicMonitorResponseMeta;
  raw?: unknown;
}

export interface BatchResult<T> {
  success: boolean;
  results: BatchItem<T>[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export interface BatchDiagnostics {
  status?: number;
  code?: string;
  requestId?: string;
  requestUrl?: string;
  requestMethod?: string;
}

export interface BatchOptions {
  maxConcurrent?: number;
  retryOnRateLimit?: boolean;
  retryOptions?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
  onProgress?: (completed: number, total: number) => void;
  continueOnError?: boolean;
}

export class BatchProcessor {
  private rateLimiter: RateLimiter;

  constructor(rateLimiterInstance: RateLimiter = rateLimiter) {
    this.rateLimiter = rateLimiterInstance;
  }

  /**
   * Process an array of items with the given processor function
   */
  async processBatch<TInput, TData>(
    items: TInput[],
    processor: (item: TInput, index: number) => Promise<
      TData | {
        data: TData;
        diagnostics?: BatchDiagnostics;
        meta?: LogicMonitorResponseMeta;
        raw?: unknown;
      }
    >,
    options: BatchOptions = {}
  ): Promise<BatchResult<TData>> {
    const {
      maxConcurrent = 5,
      retryOnRateLimit = true,
      retryOptions = {},
      onProgress,
      continueOnError = true
    } = options;

    const results: BatchItem<TData>[] = [];
    const total = items.length;
    let completed = 0;

    // Process items in chunks based on maxConcurrent
    for (let i = 0; i < items.length; i += maxConcurrent) {
      const chunk = items.slice(i, i + maxConcurrent);
      const chunkPromises = chunk.map(async (item, chunkIndex) => {
        const actualIndex = i + chunkIndex;
        
        try {
          const execute = () => processor(item, actualIndex);
          const rawResult = retryOnRateLimit
            ? await this.rateLimiter.executeWithRetry(execute, 'api-request', retryOptions)
            : await execute();

          const { data, diagnostics, meta, raw } = this.normalizeProcessorResult(rawResult);

          results[actualIndex] = {
            index: actualIndex,
            success: true,
            data,
            diagnostics,
            meta,
            raw
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results[actualIndex] = {
            index: actualIndex,
            success: false,
            error: errorMessage,
            diagnostics: this.extractDiagnosticsFromError(error)
          };

          if (!continueOnError) {
            throw error;
          }
        }

        completed++;
        if (onProgress) {
          onProgress(completed, total);
        }
      });

      // Wait for chunk to complete before processing next chunk
      await Promise.all(chunkPromises);
    }

    // Calculate summary
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: failed === 0,
      results,
      summary: {
        total,
        succeeded,
        failed
      }
    };
  }

  /**
   * Process items one at a time (serial processing)
   */
  async processSerial<TInput, TData>(
    items: TInput[],
    processor: (item: TInput, index: number) => Promise<
      TData | {
        data: TData;
        diagnostics?: BatchDiagnostics;
        meta?: LogicMonitorResponseMeta;
        raw?: unknown;
      }
    >,
    options: Omit<BatchOptions, 'maxConcurrent'> = {}
  ): Promise<BatchResult<TData>> {
    return this.processBatch(items, processor, { ...options, maxConcurrent: 1 });
  }

  /**
   * Process all items in parallel (use with caution for rate-limited APIs)
  */
  async processParallel<TInput, TData>(
    items: TInput[],
    processor: (item: TInput, index: number) => Promise<
      TData | {
        data: TData;
        diagnostics?: BatchDiagnostics;
        meta?: LogicMonitorResponseMeta;
        raw?: unknown;
      }
    >,
    options: Omit<BatchOptions, 'maxConcurrent'> = {}
  ): Promise<BatchResult<TData>> {
    return this.processBatch(items, processor, { ...options, maxConcurrent: items.length });
  }

  /**
   * Convert batch result to single result (for backward compatibility)
   */
  static unwrapSingleResult<T>(result: BatchResult<T>): T {
    if (result.results.length !== 1) {
      throw new Error('Expected single result but got multiple');
    }

    const singleResult = result.results[0];
    if (!singleResult.success) {
      throw new Error(singleResult.error || 'Operation failed');
    }

    if (singleResult.data === undefined) {
      throw new Error('No data returned');
    }

    return singleResult.data;
  }

  /**
   * Check if input is a batch request
   */
  static isBatchRequest<T>(input: T | { items: T[] } | { devices: T[] } | { groups: T[] }): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }
    
    // Check for common batch property names
    const batchProps = ['items', 'devices', 'groups', 'collectors', 'websites'];
    return batchProps.some(prop => 
      prop in input && Array.isArray((input as any)[prop])
    );
  }

  /**
   * Normalize input to array format
   */
  static normalizeToArray<T>(
    input: T | { items: T[] } | { devices: T[] } | { groups: T[] } | { collectors: T[] } | { websites: T[] }
  ): T[] {
    if (!input || typeof input !== 'object') {
      return [input as T];
    }

    // Check for batch properties
    const batchInput = input as any;
    if (Array.isArray(batchInput.items)) return batchInput.items;
    if (Array.isArray(batchInput.devices)) return batchInput.devices;
    if (Array.isArray(batchInput.groups)) return batchInput.groups;
    if (Array.isArray(batchInput.websites)) return batchInput.websites;
    if (Array.isArray(batchInput.collectors)) return batchInput.collectors;

    // Single item
    return [input as T];
  }

  private normalizeProcessorResult<T>(
    value: T | { data: T; diagnostics?: BatchDiagnostics; meta?: LogicMonitorResponseMeta; raw?: unknown }
  ): { data: T; diagnostics?: BatchDiagnostics; meta?: LogicMonitorResponseMeta; raw?: unknown } {
    if (value && typeof value === 'object' && !Array.isArray(value) && 'data' in (value as Record<string, unknown>)) {
      const structured = value as { data: T; diagnostics?: BatchDiagnostics; meta?: LogicMonitorResponseMeta; raw?: unknown };
      return {
        data: structured.data,
        diagnostics: structured.diagnostics,
        meta: structured.meta,
        raw: structured.raw
      };
    }

    return {
      data: value as T,
      diagnostics: undefined,
      meta: undefined,
      raw: undefined
    };
  }

  private extractDiagnosticsFromError(error: unknown): BatchDiagnostics | undefined {
    if (error instanceof LogicMonitorApiError) {
      return {
        status: error.status,
        code: error.code,
        requestId: error.requestId,
        requestUrl: error.requestUrl,
        requestMethod: error.requestMethod
      };
    }
    return undefined;
  }
}
// Singleton instance
export const batchProcessor = new BatchProcessor();
