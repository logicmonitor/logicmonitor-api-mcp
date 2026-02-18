/**
 * Shared types for tool registration
 */

/**
 * Metadata returned by each registerXxxTool function.
 * Used to build the ListToolsRequestSchema response without
 * accessing private SDK internals.
 */
export interface ToolRegistration {
  name: string;
  title?: string;
  description?: string;
  inputSchema: unknown;
  annotations?: Record<string, unknown>;
}
