export type SessionScope = 'variables' | 'history' | 'results' | 'all';

export interface SessionHistoryEntry {
  timestamp: string;
  tool: string;
  arguments: unknown;
  summary: string;
}

export interface SessionContext {
  id: string;
  variables: Record<string, unknown>;
  lastResults: Record<string, unknown>;
  history: SessionHistoryEntry[];
}

const DEFAULT_SESSION_ID = 'default';
const MAX_HISTORY_ENTRIES = 50;

function createEmptyContext(id: string): SessionContext {
  return {
    id,
    variables: {},
    lastResults: {},
    history: []
  };
}

function describeResult(result: unknown): string {
  if (result === null) {
    return 'null result';
  }
  if (typeof result === 'undefined') {
    return 'undefined result';
  }
  if (Array.isArray(result)) {
    return `array (${result.length} items)`;
  }
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.total === 'number') {
      parts.push(`total=${obj.total}`);
    }
    if (Array.isArray(obj.items)) {
      parts.push(`items=${obj.items.length}`);
    }
    if (typeof obj.id !== 'undefined') {
      parts.push(`id=${String(obj.id)}`);
    }
    if (parts.length === 0) {
      parts.push('object result');
    }
    return parts.join(', ');
  }
  return `${typeof result} result`;
}

export class SessionManager {
  private readonly contexts = new Map<string, SessionContext>();

  getContext(sessionId?: string): SessionContext {
    const id = sessionId ?? DEFAULT_SESSION_ID;
    let context = this.contexts.get(id);
    if (!context) {
      context = createEmptyContext(id);
      this.contexts.set(id, context);
    }
    return context;
  }

  setVariable(sessionId: string | undefined, key: string, value: unknown): SessionContext {
    const context = this.getContext(sessionId);
    context.variables[key] = value;
    return context;
  }

  getVariable(sessionId: string | undefined, key: string): { value: unknown; exists: boolean; context: SessionContext } {
    const context = this.getContext(sessionId);
    return {
      value: context.variables[key],
      exists: Object.prototype.hasOwnProperty.call(context.variables, key),
      context
    };
  }

  clear(sessionId: string | undefined, scope: SessionScope = 'all'): SessionContext {
    const context = this.getContext(sessionId);
    if (scope === 'variables' || scope === 'all') {
      context.variables = {};
    }
    if (scope === 'results' || scope === 'all') {
      context.lastResults = {};
    }
    if (scope === 'history' || scope === 'all') {
      context.history = [];
    }
    return context;
  }

  deleteContext(sessionId?: string): void {
    const id = sessionId ?? DEFAULT_SESSION_ID;
    this.contexts.delete(id);
  }

  recordResult(sessionId: string | undefined, tool: string, args: unknown, result: unknown): SessionContext {
    const context = this.getContext(sessionId);

    context.lastResults[tool] = result;
    const entry: SessionHistoryEntry = {
      timestamp: new Date().toISOString(),
      tool,
      arguments: args,
      summary: describeResult(result)
    };
    context.history.unshift(entry);
    if (context.history.length > MAX_HISTORY_ENTRIES) {
      context.history.length = MAX_HISTORY_ENTRIES;
    }
    return context;
  }

  getSnapshot(sessionId: string | undefined, options?: { historyLimit?: number; includeResults?: boolean }) {
    const context = this.getContext(sessionId);
    const historyLimit = options?.historyLimit ?? 10;
    const history = context.history.slice(0, historyLimit);

    return {
      sessionId: context.id,
      variables: { ...context.variables },
      lastResults: options?.includeResults ? { ...context.lastResults } : Object.keys(context.lastResults),
      history
    };
  }
}
