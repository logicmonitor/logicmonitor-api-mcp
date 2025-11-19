import { z } from 'zod';

/**
 * Converts a Zod schema to JSON Schema format using Zod v4's native support
 * @param schema - The Zod schema to convert
 * @returns JSON Schema representation compatible with MCP SDK
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // Use Zod v4's native JSON Schema conversion
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
  
  // Check if this is a discriminated union (has anyOf at root)
  if (jsonSchema.anyOf && Array.isArray(jsonSchema.anyOf)) {
    return flattenDiscriminatedUnion(jsonSchema);
  }
  
  // Ensure type: "object" is present
  if (!jsonSchema.type) {
    return {
      type: 'object',
      ...jsonSchema
    };
  }
  
  return jsonSchema;
}

/**
 * Flattens a discriminated union JSON Schema into a flat object schema
 * This makes all parameters visible in MCP Inspector regardless of operation
 */
function flattenDiscriminatedUnion(schema: Record<string, unknown>): Record<string, unknown> {
  const anyOf = schema.anyOf as Array<Record<string, unknown>>;
  
  // Find the discriminator field by looking at the first branch
  let discriminatorField = 'operation'; // default
  const firstBranch = anyOf[0];
  if (firstBranch.properties && typeof firstBranch.properties === 'object') {
    const props = firstBranch.properties as Record<string, unknown>;
    // Find the field with const value (discriminator)
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === 'object' && value !== null && 'const' in value) {
        discriminatorField = key;
        break;
      }
    }
  }
  
  // Collect all unique properties and their schemas from all branches
  const allProperties: Record<string, unknown> = {};
  const discriminatorValues: string[] = [];
  const requiredFields = new Set<string>();
  
  // Helper function to process a branch (handles nested unions)
  const processBranch = (branch: Record<string, unknown>) => {
    // Check if this branch is itself a nested union
    if (branch.anyOf && Array.isArray(branch.anyOf)) {
      // Recursively process nested union branches
      for (const nestedBranch of branch.anyOf as Array<Record<string, unknown>>) {
        processBranch(nestedBranch);
      }
      return;
    }
    
    if (branch.properties && typeof branch.properties === 'object') {
      const props = branch.properties as Record<string, unknown>;
      
      // Extract discriminator value
      const discriminatorProp = props[discriminatorField];
      if (typeof discriminatorProp === 'object' && discriminatorProp !== null && 'const' in discriminatorProp) {
        discriminatorValues.push(discriminatorProp.const as string);
      }
      
      // Merge all properties
      for (const [key, value] of Object.entries(props)) {
        if (key === discriminatorField) {
          // Handle discriminator specially - convert to enum
          continue;
        }
        
        if (allProperties[key]) {
          // Property exists in multiple branches - merge schemas
          const existing = allProperties[key] as Record<string, unknown>;
          const newSchema = value as Record<string, unknown>;
          
          // If schemas are different, use anyOf to combine them
          if (JSON.stringify(existing) !== JSON.stringify(newSchema)) {
            allProperties[key] = {
              anyOf: [
                ...(existing.anyOf ? (existing.anyOf as unknown[]) : [existing]),
                newSchema
              ]
            };
          }
        } else {
          // New property - add it
          allProperties[key] = value;
        }
      }
      
      // Track required fields from this branch
      if (branch.required && Array.isArray(branch.required)) {
        for (const field of branch.required) {
          if (field === discriminatorField) {
            requiredFields.add(field);
          }
        }
      }
    }
  };
  
  // Process all branches
  for (const branch of anyOf) {
    processBranch(branch);
  }
  
  // Create the discriminator property with enum (deduplicated)
  allProperties[discriminatorField] = {
    type: 'string',
    enum: Array.from(new Set(discriminatorValues)),
    description: 'The operation to perform on the resource'
  };
  
  // Build the flattened schema
  const flatSchema: Record<string, unknown> = {
    type: 'object',
    properties: allProperties,
    required: Array.from(requiredFields)
  };
  
  // Preserve other top-level properties from original schema
  for (const [key, value] of Object.entries(schema)) {
    if (key !== 'anyOf' && key !== 'type' && key !== 'properties' && key !== 'required') {
      flatSchema[key] = value;
    }
  }
  
  return flatSchema;
}

