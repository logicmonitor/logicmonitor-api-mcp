# LogicMonitor MCP Server

A Model Context Protocol (MCP) server that provides secure access to the LogicMonitor API, enabling AI assistants to manage monitoring infrastructure through natural language commands.

## Features

- **Comprehensive Resource Management**: Devices, device groups, websites, website groups, collectors, and alerts
- **Batch Operations**: Process multiple items efficiently with rate limiting and error handling
- **Secure Authentication**: Credentials passed per-request, never stored
- **Flexible Deployment**: Supports both stdio (local) and HTTP (remote) transports
- **Natural Language Interface**: Designed for AI assistants like Claude
- **Session Context**: Built-in session tools keep track of recent results, stored variables, and request history for follow-up actions

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

### Device Management
- `lm_list_devices` - List devices with filtering
- `lm_get_device` - Get device details
- `lm_create_device` - Add device(s) to monitoring
- `lm_update_device` - Update device(s) configuration
- `lm_delete_device` - Remove device(s) from monitoring

### Device Group Management
- `lm_list_device_groups` - List device groups
- `lm_get_device_group` - Get group details
- `lm_create_device_group` - Create device group(s)
- `lm_update_device_group` - Update group(s)
- `lm_delete_device_group` - Delete group(s)

### Website Monitoring
- `lm_list_websites` - List monitored websites
- `lm_get_website` - Get website details
- `lm_create_website` - Add website(s) to monitoring
- `lm_update_website` - Update website(s)
- `lm_delete_website` - Remove website(s)

### Website Group Management
- `lm_list_website_groups` - List website groups
- `lm_get_website_group` - Get group details
- `lm_create_website_group` - Create website group(s)
- `lm_update_website_group` - Update group(s)
- `lm_delete_website_group` - Delete group(s)

### Alert Management
- `lm_list_alerts` - List alerts with filtering
- `lm_get_alert` - Get alert details
- `lm_ack_alert` - Acknowledge an alert
- `lm_add_alert_note` - Add note to alert
- `lm_escalate_alert` - Escalate alert

### Collector Management
- `lm_list_collectors` - List collectors

### Session Utilities
- `lm_get_session_context` - View stored variables, last results, and recent history for the active session
- `lm_set_session_variable` - Persist custom key/value pairs across tool calls during the session
- `lm_get_session_variable` - Retrieve values previously stored in the session
- `lm_clear_session_context` - Reset session state (variables, results, history)
- `lm_list_session_history` - Inspect recent MCP tool invocations and summaries

## Usage Examples

Once configured, you can use natural language with your AI assistant:

### Simple Operations
```
"Add server web-01.example.com (192.168.1.10) to monitoring in group Production using collector 1"

"List all devices in the Production group"

"Disable alerting on device ID 1234"
```

### Batch Operations
```
"Add these servers to monitoring:
- web-01 (10.0.1.1) in group Production
- web-02 (10.0.1.2) in group Production
- db-01 (10.0.2.1) in group Dev
All should use collector 1"

"Update all devices matching 'test-*' to disable alerting"
```

### Complex Workflows
```
"Create a device group structure:
- Production
  - Web Servers
  - Database Servers
- Staging
  - Web Servers
  - Database Servers"
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

MIT
