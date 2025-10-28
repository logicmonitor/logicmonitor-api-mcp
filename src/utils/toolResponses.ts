export type ReturnMode = 'summary' | 'raw' | 'both';

const VALID_RETURN_MODES: ReturnMode[] = ['summary', 'raw', 'both'];

export function resolveReturnMode(value: unknown): ReturnMode {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALID_RETURN_MODES.includes(normalized as ReturnMode)) {
      return normalized as ReturnMode;
    }
  }
  return 'both';
}

interface BuildToolResponseOptions<TSummary, TRaw> {
  mode: ReturnMode;
  summary?: TSummary;
  raw?: TRaw;
  meta?: unknown;
  request?: unknown;
  diagnostics?: unknown;
  extra?: Record<string, unknown>;
}

export function buildToolResponse<TSummary, TRaw>({
  mode,
  summary,
  raw,
  meta,
  request,
  diagnostics,
  extra
}: BuildToolResponseOptions<TSummary, TRaw>) {
  const payload: Record<string, unknown> = {
    mode
  };

  if (meta) {
    payload.meta = meta;
  }

  if (request) {
    payload.request = request;
  }

  if (diagnostics) {
    payload.diagnostics = diagnostics;
  }

  if (extra) {
    Object.assign(payload, extra);
  }

  const hasSummary = typeof summary !== 'undefined';
  const hasRaw = typeof raw !== 'undefined';

  if (mode === 'raw') {
    if (hasRaw) {
      payload.raw = raw;
    }
  } else if (mode === 'summary') {
    if (hasSummary) {
      payload.summary = summary;
    }
  } else {
    if (hasSummary) {
      payload.summary = summary;
    }
    if (hasRaw) {
      payload.raw = raw;
    }
  }

  return payload;
}
