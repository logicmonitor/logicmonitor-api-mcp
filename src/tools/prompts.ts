/**
 * MCP Prompts for LogicMonitor workflows
 */

import { Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Export Device Metrics Prompt
 * Guides through the process of exporting metric data from LogicMonitor devices
 */
export const exportDeviceMetricsPrompt: Prompt = {
  name: 'export-device-metrics',
  description: 'Guide through exporting metric data from LogicMonitor devices. This workflow helps you retrieve monitoring data by walking through device selection, datasource discovery, instance enumeration, and metric data retrieval.',
  arguments: [
    {
      name: 'device_identifier',
      description: 'Device ID, name, or filter to identify device(s). Examples: device ID "123", name filter "displayName:*prod*", or "all production servers"',
      required: true
    },
    {
      name: 'datasource_filter',
      description: 'Optional wildcard filter for datasources (e.g., "CPU*", "*Memory*", "Disk*"). Leave empty to include all datasources.',
      required: false
    },
    {
      name: 'time_range_hours',
      description: 'Hours of historical data to retrieve. Defaults to 24 hours if not specified.',
      required: false
    }
  ]
};

/**
 * Get prompt content with instructions
 */
export function getPromptContent(promptName: string, args: Record<string, string>): string {
  if (promptName === 'export-device-metrics') {
    const deviceIdentifier = args.device_identifier || 'the specified device(s)';
    const datasourceFilter = args.datasource_filter || 'all datasources';
    const timeRangeHours = args.time_range_hours || '24';

    return `# Export Device Metrics Workflow

You are helping to export monitoring data from LogicMonitor for ${deviceIdentifier}.

## Workflow Steps:

### Step 1: Identify Device(s)
Use the \`lm_device\` tool to find the device(s):
- If given a device ID, use: \`{"operation": "get", "id": <device_id>}\`
- If given a name or filter, use: \`{"operation": "list", "filter": "<filter>"}\`
- Store the device ID(s) for the next steps

### Step 2: List Datasources
For each device, use \`lm_device_data\` to list available datasources:
\`\`\`json
{
  "operation": "list_datasources",
  "deviceId": <device_id>,
  "datasourceIncludeFilter": "${datasourceFilter === 'all datasources' ? '' : datasourceFilter}"
}
\`\`\`

Filter the results to datasources with active instances (monitoringInstanceNumber > 0).

### Step 3: List Instances
For each datasource, list its instances:
\`\`\`json
{
  "operation": "list_instances",
  "deviceId": <device_id>,
  "datasourceId": <datasource_id>
}
\`\`\`

Filter out instances where stopMonitoring is true.

### Step 4: Retrieve Metric Data
For each instance (or batch of instances), retrieve the metric data:
\`\`\`json
{
  "operation": "get_data",
  "deviceId": <device_id>,
  "datasourceId": <datasource_id>,
  "instanceIds": [<instance_id1>, <instance_id2>, ...],
  "startDate": "<ISO 8601 timestamp for ${timeRangeHours} hours ago>",
  "endDate": "<ISO 8601 timestamp for now>"
}
\`\`\`

### Step 5: Format Results
Present the data in a structured format showing:
- Device name and ID
- Datasource name
- Instance name
- Time range
- Metric values with timestamps

## Tips:
- Use batch operations (instanceIds array) to retrieve data for multiple instances at once
- The default time range is 24 hours if not specified
- Filter datasources by name pattern to focus on specific metrics (e.g., "CPU*" for CPU metrics)
- Check monitoringInstanceNumber > 0 to ensure datasources have active data

Begin by identifying the device(s) and proceed through each step systematically.`;
  }

  return 'Unknown prompt';
}

/**
 * List all available prompts
 */
export function listPrompts(): Prompt[] {
  return [exportDeviceMetricsPrompt];
}

/**
 * Get a specific prompt by name
 */
export function getPrompt(name: string): Prompt | undefined {
  const prompts = listPrompts();
  return prompts.find(p => p.name === name);
}

