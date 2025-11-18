import swaggerDocument from '../../docs/swagger.json' with { type: 'json' };
import { parseFieldList } from './fieldSelection.js';

export type ResourceKey = 'device' | 'deviceGroup' | 'collector' | 'website' | 'websiteGroup' | 'alert' | 'user' | 'dashboard' | 'collectorGroup';

interface FieldInfo {
  definitionName: string;
  fields: Set<string>;
}

const resourceDefinitionMap: Record<ResourceKey, string> = {
  device: 'Device',
  deviceGroup: 'DeviceGroup',
  collector: 'Collector',
  website: 'Website',
  websiteGroup: 'WebsiteGroup',
  alert: 'Alert',
  user: 'Admin',
  dashboard: 'Dashboard',
  collectorGroup: 'CollectorGroup'
};

const cache = new Map<ResourceKey, FieldInfo>();

function buildFieldInfo(resource: ResourceKey): FieldInfo {
  if (cache.has(resource)) {
    const cached = cache.get(resource);
    if (!cached) {
      throw new Error(`Failed to get cached field info for resource: ${resource}`);
    }
    return cached;
  }

  const definitionName = resourceDefinitionMap[resource];
  const definition = (swaggerDocument as any)?.definitions?.[definitionName];
  const properties = definition?.properties ?? {};
  const fields = new Set<string>(Object.keys(properties));

  const info: FieldInfo = { definitionName, fields };
  cache.set(resource, info);
  return info;
}

export function getKnownFields(resource: ResourceKey): Set<string> {
  return new Set(buildFieldInfo(resource).fields);
}

export function validateRequestedFields(resource: ResourceKey, requested: string[]) {
  const known = buildFieldInfo(resource).fields;
  const applied: string[] = [];
  const invalid: string[] = [];

  requested.forEach((field) => {
    if (known.has(field) || field === '*') {
      applied.push(field);
    } else {
      invalid.push(field);
    }
  });

  return { applied, invalid };
}

export function sanitizeFields(resource: ResourceKey, fields?: string | null) {
  const requested = parseFieldList(fields);
  const { applied, invalid } = validateRequestedFields(resource, requested);
  const includeAll = applied.includes('*') || applied.length === 0;
  const base = includeAll ? [] : applied;
  const required = requiredFields.get(resource) ?? [];
  const normalizedApplied = includeAll ? [] : Array.from(new Set([...base, ...required]));
  const fieldsParam = includeAll ? undefined : normalizedApplied.join(',');

  return {
    requested,
    applied: normalizedApplied,
    includeAll,
    fieldsParam,
    invalid
  };
}

const requiredFields = new Map<ResourceKey, string[]>([
  ['device', ['id']],
  ['deviceGroup', ['id']],
  ['website', ['id']],
  ['websiteGroup', ['id']],
  ['collector', ['id']],
  ['alert', ['id']]
]);
