[![Test Suite](https://github.com/logicmonitor/logicmonitor-api-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/logicmonitor/logicmonitor-api-mcp/actions/workflows/test.yml)

# LogicMonitor MCP Server

> **⚠️ Community Project Disclaimer**
> 
> This is an open-source community project and is **not officially supported by LogicMonitor**. While hosted in the LogicMonitor github organization, support is provided on an "as-is" basis through GitHub issues and community contributions. For questions, bug reports, or feature requests, please open an issue on this repository.

A Model Context Protocol (MCP) server that provides secure access to the LogicMonitor API, enabling AI assistants to manage monitoring infrastructure through natural language commands.

## Features

- **Comprehensive Resource Management**: Devices, device groups, websites, website groups, collectors, alerts, users, dashboards, collector groups, and device metrics
- **Device Metrics & Data**: Retrieve monitoring data including datasources, instances, and time-series metrics
- **Batch Operations**: Process multiple items efficiently with rate limiting and error handling
- **Guided Workflows**: Built-in prompts for complex tasks like exporting device metrics
- **Secure Authentication**: Credentials passed per-request, never stored
- **Flexible Deployment**: Supports both stdio (local) and HTTP (remote) transports
- **Natural Language Interface**: Designed for AI assistants like Claude
- **Session Context**: Built-in session tools keep track of recent results, stored variables, and request history for follow-up actions

### Tool Responses & Field Selection

- All tools now return the full LogicMonitor API payload (`raw`) together with request metadata so downstream agents never lose fields that the API exposes.
- When specifying the optional `fields` parameter, only LogicMonitor-supported field names are accepted. Invalid field names trigger a `InvalidParams` error to prevent silent data loss or filtering mistakes.
-  The `src/schemas/swagger.json` file shipped with the project contains the authoritative schema for each resource if you need to look up the available fields.
- Responses always include:
  - `items` / `device`, etc. – parsed data objects for convenience
  - `raw` – the exact API payload
  - `meta` – request/response metadata (status, timing, rate-limit info)
  - `request` – the effective parameters sent to LogicMonitor (validated field list, offsets, filters, etc.)

## Installation

### Option 1: Install from npm (Recommended)

```bash
npm install -g logicmonitor-api-mcp
```

### Option 2: Install from Source

```bash
# Clone the repository
git clone https://github.com/stevevillardi/logicmonitor-api-mcp.git
cd logicmonitor-api-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### Prerequisites

You'll need:
1. A LogicMonitor account
2. A Bearer API token (Settings → Users → API Tokens)

### STDIO Mode (Recommended for Local Use)

STDIO mode is best for local AI assistants like Claude Desktop. Add to your MCP settings:

```json
{
  "mcpServers": {
    "logicmonitor": {
      "command": "logicmonitor-api-mcp",
      "args": ["--stdio"],
      "env": {
        "LM_ACCOUNT": "your-account-name",
        "LM_BEARER_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

If installed from source, use the full path:

```json
{
  "mcpServers": {
    "logicmonitor": {
      "command": "node",
      "args": ["/path/to/logicmonitor-api-mcp/dist/index.js", "--stdio"],
      "env": {
        "LM_ACCOUNT": "your-account-name",
        "LM_BEARER_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

### HTTP Mode (For Remote Access)

HTTP mode allows remote access and is suitable for shared deployments:

1. **Start the server:**
```bash
# With environment variables
LM_ACCOUNT=your-account LM_BEARER_TOKEN=your-bearer-token PORT=3000 logicmonitor-api-mcp

# Or use a .env file
echo "PORT=3000" > .env
logicmonitor-api-mcp
```

2. **Configure your MCP client:**

Option A - Pass credentials via headers (more secure):
```json
{
  "mcpServers": {
    "logicmonitor": {
      "url": "http://localhost:3000/mcp",
      "transport": "http",
      "headers": {
        "X-LM-Account": "your-account-name",
        "X-LM-Bearer-Token": "your-bearer-token"
      }
    }
  }
}
```

Option B - Server-side credentials (for trusted environments):
```bash
# Start server with credentials
LM_ACCOUNT=your-account LM_BEARER_TOKEN=your-token logicmonitor-api-mcp
```

Then connect without credentials in headers:
```json
{
  "mcpServers": {
    "logicmonitor": {
      "url": "http://localhost:3000/mcp",
      "transport": "http"
    }
  }
}
```

When no `X-LM-*` headers are provided, the server falls back to `LM_ACCOUNT` and `LM_BEARER_TOKEN` environment variables that were set when the process started.

### Authentication

The server supports two auth modes (`AUTH_MODE`):

- `none` (default): No MCP client authentication. Only safe for STDIO transport or trusted networks.
- `bearer`: Static bearer token authentication. Clients send `Authorization: Bearer <token>`.

**LogicMonitor Credentials** are resolved in priority order:
1. **X-LM-Account + X-LM-Bearer-Token headers** (highest priority, per-request override)
2. **AUTH_CREDENTIAL_MAPPING** (maps bearer token/clientId to LM credentials)
3. **LM_ACCOUNT + LM_BEARER_TOKEN** (default fallback)

**Bearer Token Configuration**
```bash
AUTH_MODE=bearer
MCP_BEARER_TOKENS=token1,token2,token3

# Option 1: Use per-request headers (most flexible)
# Clients send X-LM-Account and X-LM-Bearer-Token headers with each request

# Option 2: Map bearer tokens to LM credentials
AUTH_CREDENTIAL_MAPPING='{"token1":{"account":"prod","token":"lm-xyz"},"token2":{"account":"dev","token":"lm-abc"}}'

# Option 3: Use default credentials (fallback for all tokens)
LM_ACCOUNT=default-account
LM_BEARER_TOKEN=default-lm-token

# Wildcard mapping (applies to any token not explicitly mapped)
AUTH_CREDENTIAL_MAPPING='{"*":{"account":"shared","token":"lm-default"}}'
```

**Example: Bearer token with per-request credentials**
```bash
curl -H "Authorization: Bearer token1" \
     -H "X-LM-Account: mycompany" \
     -H "X-LM-Bearer-Token: my-lm-token" \
     -H "Content-Type: application/json" \
     https://your-server:3000/mcp
```

## Available Tools

The server provides **resource-based tools** that handle all CRUD operations through an `operation` parameter:

### Core Resource Tools

#### `lm_device`
Manage LogicMonitor devices with all operations:
- **list** - List devices with filtering and pagination
- **get** - Get device details (ID can be omitted if referencing last operation)
- **create** - Add single device or batch of devices
- **update** - Update single device or batch (supports explicit arrays, applyToPrevious, filter-based)
- **delete** - Remove single device or batch

#### `lm_device_group`
Manage device groups with full CRUD support:
- **list** - List device groups
- **get** - Get group details
- **create** - Create single or multiple groups
- **update** - Update groups (single or batch)
- **delete** - Delete groups (with optional deleteChildren)

#### `lm_website`
Manage website monitoring:
- **list** - List monitored websites
- **get** - Get website details
- **create** - Add websites to monitoring
- **update** - Update website configuration
- **delete** - Remove websites

#### `lm_website_group`
Manage website groups:
- **list** - List website groups
- **get** - Get group details
- **create** - Create website groups
- **update** - Update groups
- **delete** - Delete groups

#### `lm_collector`
List and view collectors (read-only):
- **list** - List collectors with filtering

#### `lm_alert`
Manage alerts (read and update only):
- **list** - List alerts with filtering
- **get** - Get alert details
- **update** - Perform actions (ack, note, escalate)

#### `lm_user`
Manage LogicMonitor users:
- **list** - List users with filtering
- **get** - Get user details
- **create** - Create single user or batch of users
- **update** - Update users (single or batch)
- **delete** - Delete users (single or batch)

#### `lm_dashboard`
Manage LogicMonitor dashboards:
- **list** - List dashboards with filtering
- **get** - Get dashboard details
- **create** - Create single dashboard or batch
- **update** - Update dashboards (single or batch)
- **delete** - Delete dashboards (single or batch)

#### `lm_collector_group`
Manage collector groups:
- **list** - List collector groups with filtering
- **get** - Get collector group details
- **create** - Create single collector group or batch
- **update** - Update collector groups (single or batch)
- **delete** - Delete collector groups (single or batch)

#### `lm_device_data`
Retrieve device monitoring data including datasources, instances, and time-series metrics:
- **list_datasources** - List datasources for a device (supports wildcard include/exclude filters)
- **list_instances** - List instances for a specific datasource
- **get_data** - Retrieve metric data for one or more instances (supports batch retrieval)

Key features:
- Wildcard filtering for datasources (e.g., `datasourceIncludeFilter: "CPU*"`)
- Batch instance data retrieval (e.g., all CPU cores at once)
- Flexible time ranges (ISO 8601 dates or Unix epochs, defaults to last 24 hours)
- Formatted output with timestamps and metric values

#### `lm_session`
Manage session context and variables using standard CRUD operations:

**Operations:**
- **list** - Get session history (recent tool calls)
  - Parameters: `limit` (optional, 1-50)
- **get** - Get session context or specific variable
  - Parameters: `key` (optional - if omitted, returns full context), `historyLimit`, `includeResults`
- **create** - Store a new session variable
  - Parameters: `key` (required), `value` (required)
  - Use for storing results for batch operations with applyToPrevious
- **update** - Update an existing session variable
  - Parameters: `key` (required), `value` (required)
- **delete** - Clear session data
  - Parameters: `scope` (optional: 'variables', 'history', 'results', or 'all')

**Example Usage:**
```json
// Store devices for batch operations
{ "operation": "create", "key": "myDevices", "value": [...] }

// Get a stored variable
{ "operation": "get", "key": "myDevices" }

// View session history
{ "operation": "list", "limit": 10 }

// Clear all session data
{ "operation": "delete", "scope": "all" }
```

## Available Prompts

The server provides guided workflows for complex multi-step tasks:

### `export-device-metrics`
A comprehensive workflow that guides you through exporting monitoring data from LogicMonitor devices.

**Arguments:**
- `device_identifier` (required) - Device ID, name, or filter (e.g., "123", "displayName:*prod*")
- `datasource_filter` (optional) - Wildcard filter for datasources (e.g., "CPU*", "*Memory*")
- `time_range_hours` (optional) - Hours of historical data to retrieve (default: 24)

**Workflow Steps:**
1. Identify target device(s)
2. List available datasources (with optional filtering)
3. Enumerate instances for each datasource
4. Retrieve metric data for instances
5. Format and present results

**Example Usage:**
```
"Use the export-device-metrics prompt to get CPU and memory data for device 123 over the last 48 hours"
```

The prompt will guide the AI through each step, ensuring proper data collection and formatting.

## Key Features

### Automatic ID Resolution
The server automatically resolves resource IDs from previous operations:
```
# Create a device
lm_device({ operation: "create", displayName: "web-01", ... })

# Update it without specifying ID - automatically uses last created device
lm_device({ operation: "update", disableAlerting: true })
```

### Flexible Batch Operations
Three ways to perform batch operations:

**1. Explicit Arrays**
```json
{
  "operation": "update",
  "devices": [
    {"id": 123, "disableAlerting": true},
    {"id": 456, "disableAlerting": true}
  ]
}
```

**2. Apply to Previous Results**
```json
// First, list devices
{"operation": "list", "filter": "name:web*"}

// Then update all from previous list
{
  "operation": "update",
  "applyToPrevious": "lastDeviceList",
  "updates": {"disableAlerting": true}
}
```

**3. Filter-Based Batch**
```json
{
  "operation": "update",
  "filter": "name:web*",
  "updates": {"disableAlerting": true}
}
```

## Usage Examples

### Simple Operations
```
"Add server web-01.example.com (192.168.1.10) to monitoring in group Production using collector 1"

"List all devices in the Production group"

"Get details for device 1234"

"Update the device to disable alerting"  # Automatically uses device from previous operation
```

### Batch Operations with Natural Language
```
"List all devices with names starting with 'web'"

"Update all those devices to disable alerting"  # Uses applyToPrevious automatically

"Create these device groups:
- Production Web Servers (parent: 1)
- Production Database Servers (parent: 1)
- Staging Web Servers (parent: 2)"
```

### Filter-Based Batch Operations
```
"Update all devices matching 'test-*' to disable alerting"
# Translates to: lm_device({ operation: "update", filter: "name:test*", updates: { disableAlerting: true }})

"Delete all devices in the 'temp' group"
# Uses filter-based batch delete with safety checks
```

### Working with Alerts
```
"List all critical alerts that aren't cleared"

"Acknowledge the first alert with comment 'Investigating'"

"Add a note to alert 12345 saying 'Fixed in deploy #456'"
```

### Retrieving Device Metrics
```
"List all datasources for device 123"

"Show me CPU metrics for device 123 over the last 24 hours"

"Get memory usage data for all instances on device 456 for the past week"

"Use the export-device-metrics prompt to get all CPU and Memory data for production servers"
```

## Development

### Running from Source

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug logicmonitor-api-mcp
```

## Architecture

- **Transport Layer**: Supports both STDIO and streamable HTTP
- **Session Management**: Stateful connections with cleanup
- **Rate Limiting**: Automatic retry with exponential backoff
- **Batch Processing**: Concurrent operations with partial failure handling
- **Input Validation**: Joi schemas ensure data integrity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the Mozilla Public License 2.0 (MPL-2.0). See the [LICENSE](LICENSE) file for details.

### Third-Party Dependencies

This project uses third-party dependencies that are licensed under permissive open-source licenses (MIT, BSD, ISC). These licenses are compatible with MPL-2.0. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for details.
