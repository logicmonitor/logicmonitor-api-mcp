import type { BaseOperationArgs, OperationResult, OperationType } from '../../types/operations.js';
import { capitalizeFirst } from '../../utils/strings.js';

interface ToolResponseConfig {
  resourceName: string;
  resourceTitle: string;
  sessionKeyOverrides?: string[];
  notes?: string[];
}

export function buildToolResponse<T>(
  args: BaseOperationArgs,
  result: OperationResult<T>,
  config: ToolResponseConfig
) {
  const summary = formatSummary(args.operation, result, config);

  return {
    content: [
      {
        type: 'text' as const,
        text: summary
      },
      {
        type: 'text' as const,
        text: `Full LogicMonitor payload:\n${JSON.stringify(result, null, 2)}`
      }
    ]
  };
}

function formatSummary<T>(
  operation: OperationType,
  result: OperationResult<T>,
  config: ToolResponseConfig
) {
  const lines: string[] = [];
  const status = result.success ? 'succeeded' : 'completed';
  lines.push(`${config.resourceTitle} ${operation} ${status}.`);

  const effect = describeEffect(result);
  if (effect) {
    lines.push(effect);
  }

  const sessionKeys = getSessionKeys(operation, result, config);
  if (sessionKeys.length > 0) {
    lines.push(`Session keys ready: ${sessionKeys.join(', ')}.`);
    lines.push('Reuse them via lm_session get or applyToPrevious to avoid duplicate queries.');
  }

  if (config.notes?.length) {
    lines.push(...config.notes);
  }

  if (lines.length === 1) {
    lines.push('See JSON payload for full API response.');
  }

  return lines.join('\n');
}

function describeEffect<T>(result: OperationResult<T>) {
  if (Array.isArray(result.items)) {
    return `Affected items: ${result.items.length}.`;
  }
  if (typeof result.total === 'number') {
    return `Total items reported: ${result.total}.`;
  }
  if (result.summary) {
    return `Batch summary: ${result.summary.succeeded}/${result.summary.total} succeeded.`;
  }
  if (result.data) {
    return 'Single resource payload stored in session.';
  }
  return undefined;
}

function getSessionKeys<T>(
  operation: OperationType,
  result: OperationResult<T>,
  config: ToolResponseConfig
) {
  if (Array.isArray(config.sessionKeyOverrides)) {
    return config.sessionKeyOverrides;
  }
  if (config.resourceName === 'session') {
    return [];
  }
  return deriveDefaultSessionKeys(operation, result, config.resourceName);
}

function deriveDefaultSessionKeys<T>(
  operation: OperationType,
  result: OperationResult<T>,
  resourceName: string
) {
  const keys: string[] = [];
  const capitalized = capitalizeFirst(resourceName);

  if (operation === 'list' && Array.isArray(result.items) && result.items.length > 0) {
    keys.push(`session.last${capitalized}List`, `session.last${capitalized}ListIds`);
  }

  if (operation === 'get' && result.data) {
    keys.push(`session.last${capitalized}`, `session.last${capitalized}Id`);
  }

  if (operation === 'create') {
    if (result.data) {
      keys.push(`session.lastCreated${capitalized}`, `session.last${capitalized}`);
    } else if (Array.isArray(result.items) && result.items.length > 0) {
      keys.push(`session.lastCreated${capitalized}s`);
    }
  }

  if (operation === 'update') {
    if (result.data) {
      keys.push(`session.lastUpdated${capitalized}`, `session.last${capitalized}`);
    } else if (Array.isArray(result.items) && result.items.length > 0) {
      keys.push(`session.lastUpdated${capitalized}s`);
    }
  }

  if (operation === 'delete' && result.data) {
    keys.push(`session.lastDeleted${capitalized}Id`);
  }

  return keys;
}


