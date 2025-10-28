/**
 * LogicMonitor API Filter Utilities
 * 
 * Based on LogicMonitor REST API documentation:
 * - Pattern: <field name><operator><values>
 * - Operators: : (equal), !: (not equal), > < >: <: (comparison), ~ (contain), !~ (not contain)
 * - String values need double quotes: name:"value"
 * - Multiple values use | (OR): status:"active"|"suspend" 
 * - Multiple conditions use , (AND): name:"test",status:"active"
 * - Logical OR between conditions use || (OR): name:"aaa"||status:"suspend"
 * 
 * Examples:
 * - displayName:"*villa*"
 * - hostStatus:"alive"
 * - id>:100
 * - displayName:"prod*",hostStatus:"alive" (AND)
 * - name:"web*"||name:"app*" (OR)
 */

interface FilterOptions {
  allowedFields?: Set<string>;
  resourceName?: string;
}

export function formatLogicMonitorFilter(filter: string, options: FilterOptions = {}): string {
  if (!filter) return filter;
  
  // Split on logical operators (, for AND, || for OR) while preserving them
  const parts = filter.split(/(\s*(?:,|\|\|)\s*)/);
  
  const formattedParts = parts.map(part => {
    // Skip logical operators
    if (part.match(/^\s*(?:,|\|\|)\s*$/)) {
      return part;
    }
    
    // Process individual conditions
    return formatFilterCondition(part.trim(), options);
  });
  
  return formattedParts.join('');
}

function formatFilterCondition(condition: string, options: FilterOptions): string {
  // Handle LogicMonitor operators: :, !:, >, <, >:, <:, ~, !~
  // Match pattern: property<operator>value(s)
  const operatorMatch = condition.match(/^([^:!><~]+)([:!><~]+)(.*)$/);
  if (!operatorMatch) {
    return condition; // Return as-is if not recognized pattern
  }
  
  const [, property, operator, value] = operatorMatch;
  const cleanProperty = property.trim();
  const cleanOperator = operator.trim();
  const cleanValue = value.trim();

  if (options.allowedFields && !options.allowedFields.has(cleanProperty)) {
    const resource = options.resourceName ? `${options.resourceName} ` : '';
    throw new Error(`Unknown ${resource}filter field: ${cleanProperty}`);
  }
  
  // Handle multiple values separated by | (OR within same field)
  if (cleanValue.includes('|') && !cleanValue.startsWith('"')) {
    const values = cleanValue.split('|').map(v => {
      const trimmed = v.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed; // Already quoted
      }
      return needsQuoting(trimmed) ? `"${trimmed}"` : trimmed;
    });
    return `${cleanProperty}${cleanOperator}${values.join('|')}`;
  }
  
  // Check if value is already properly quoted
  if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
    return `${cleanProperty}${cleanOperator}${cleanValue}`;
  }
  
  // Check if value needs quoting
  if (needsQuoting(cleanValue)) {
    return `${cleanProperty}${cleanOperator}"${cleanValue}"`;
  }
  
  // Return as-is for numeric values
  return `${cleanProperty}${cleanOperator}${cleanValue}`;
}

function needsQuoting(value: string): boolean {
  // Special case: if already quoted, don't double quote
  if (value.startsWith('"') && value.endsWith('"')) {
    return false;
  }
  
  // Don't quote pure integers
  if (/^\d+$/.test(value)) {
    return false;
  }
  
  // Don't quote pure decimals
  if (/^\d+\.\d+$/.test(value)) {
    return false;
  }
  
  // Don't quote boolean values
  if (value === 'true' || value === 'false') {
    return false;
  }
  
  // Quote ALL string values - LogicMonitor API requires string values to be quoted
  return true;
}

// Common filter patterns for documentation
export const FILTER_EXAMPLES = {
  devices: [
    'displayName:"*prod*"',
    'hostStatus:"alive"',
    'displayName:"web*",hostStatus:"alive"', // AND with comma
    'name:"web*"||name:"app*"', // OR with ||
    'id>:100', // Greater than or equal
    'disableAlerting:false',
    'hostStatus:"active"|"pending"' // Multiple values with |
  ],
  deviceGroups: [
    'name:"*servers*"',
    'parentId:1',
    'name:"production*"',
    'name~"test"' // Contains
  ]
};
