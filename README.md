# LogicMonitor MCP Server

A Model Context Protocol (MCP) server that provides secure access to the LogicMonitor API, enabling AI assistants to manage monitoring infrastructure through natural language commands.

## Features

- **Comprehensive Resource Management**: Devices, device groups, websites, website groups, collectors, alerts, users, dashboards, and collector groups
- **Batch Operations**: Process multiple items efficiently with rate limiting and error handling
- **Secure Authentication**: Credentials passed per-request, never stored
- **Flexible Deployment**: Supports both stdio (local) and HTTP (remote) transports
- **Natural Language Interface**: Designed for AI assistants like Claude
- **Session Context**: Built-in session tools keep track of recent results, stored variables, and request history for follow-up actions

### Tool Responses & Field Selection

- All tools now return the full LogicMonitor API payload (`raw`) together with request metadata so downstream agents never lose fields that the API exposes.
- When specifying the optional `fields` parameter, only LogicMonitor-supported field names are accepted. Invalid field names trigger a `InvalidParams` error to prevent silent data loss or filtering mistakes.
- Use `*` (or omit `fields`) to request the complete object. The `docs/swagger.json` file shipped with the project contains the authoritative schema for each resource if you need to look up the available fields.
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
git clone https://github.com/stevevillardi/lm-api-mcp.git
cd lm-api-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Optional: Link globally
npm link
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
      "args": ["/path/to/lm-api-mcp/dist/index.js", "--stdio"],
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

## Available Tools

The server provides **9 resource-based tools** that handle all CRUD operations through an `operation` parameter:

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

### Session Utilities
- `lm_get_session_context` - View stored variables, last results, and recent history
- `lm_set_session_variable` - Persist custom key/value pairs across tool calls
- `lm_get_session_variable` - Retrieve stored session values
- `lm_clear_session_context` - Reset session state
- `lm_list_session_history` - Inspect recent tool invocations

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
