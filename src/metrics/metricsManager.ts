import { performance } from 'perf_hooks';

export interface ToolMetricSnapshot {
  tool: string;
  total: number;
  success: number;
  failure: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastFailureMessage?: string;
  metadata?: Record<string, unknown>;
}

interface ToolMetricInternal extends ToolMetricSnapshot {
  metadata?: Record<string, unknown>;
}

export interface MetricsSnapshot {
  generatedAt: string;
  uptimeMs: number;
  tools: ToolMetricSnapshot[];
}

class MetricsManager {
  private readonly metrics = new Map<string, ToolMetricInternal>();
  private readonly startTime = performance.now();

  recordSuccess(tool: string, metadata?: Record<string, unknown>) {
    const entry = this.ensureEntry(tool);
    entry.total += 1;
    entry.success += 1;
    entry.lastSuccessAt = new Date().toISOString();
    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = { ...metadata };
    }
  }

  recordFailure(tool: string, error: Error | string, metadata?: Record<string, unknown>) {
    const entry = this.ensureEntry(tool);
    entry.total += 1;
    entry.failure += 1;
    entry.lastFailureAt = new Date().toISOString();
    entry.lastFailureMessage = typeof error === 'string' ? error : error.message;
    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = { ...metadata };
    }
  }

  getSnapshot(): MetricsSnapshot {
    const generatedAt = new Date().toISOString();
    const uptimeMs = performance.now() - this.startTime;
    const tools = Array.from(this.metrics.values()).map((metric) => ({
      tool: metric.tool,
      total: metric.total,
      success: metric.success,
      failure: metric.failure,
      lastSuccessAt: metric.lastSuccessAt,
      lastFailureAt: metric.lastFailureAt,
      lastFailureMessage: metric.lastFailureMessage,
      metadata: metric.metadata ? { ...metric.metadata } : undefined
    }));

    return { generatedAt, uptimeMs, tools };
  }

  private ensureEntry(tool: string): ToolMetricInternal {
    if (!this.metrics.has(tool)) {
      this.metrics.set(tool, {
        tool,
        total: 0,
        success: 0,
        failure: 0
      });
    }
    const metrics = this.metrics.get(tool);
    if (!metrics) {
      throw new Error(`Failed to get metrics for tool: ${tool}`);
    }
    return metrics;
  }
}

export const metricsManager = new MetricsManager();
