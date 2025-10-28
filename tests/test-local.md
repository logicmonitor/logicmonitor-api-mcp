# Testing the LogicMonitor MCP Server

## Prerequisites
- LogicMonitor account with API access
- Bearer token generated from LogicMonitor portal

## Setup Test Credentials

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and update these values:
```
LM_ACCOUNT=your_actual_account
LM_BEARER_TOKEN=your_actual_bearer_token
```

## 1. Local Testing with stdio (Quick Test)

### Start the server in stdio mode:
```bash
npm run dev -- --stdio
```

### Send a test request:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

This should return a list of available tools.

## 2. HTTP Testing

### Start the server:
```bash
npm run dev
```

The server will start on port 3001 (based on your .env.example).

### Test the health endpoint:
```bash
curl http://localhost:3001/health
```

### Test with MCP Inspector (Recommended)

Install MCP Inspector:
```bash
npm install -g @modelcontextprotocol/inspector
```

Create a test configuration file `test-config.json`:
```json
{
  "mcpServers": {
    "logicmonitor": {
      "url": "http://localhost:3001/mcp",
      "transport": "http",
      "headers": {
        "X-LM-Account": "YOUR_ACCOUNT",
        "X-LM-Bearer-Token": "YOUR_BEARER_TOKEN"
      }
    }
  }
}
```

Run MCP Inspector:
```bash
mcp-inspector test-config.json
```

If the server was started with `LM_ACCOUNT` and `LM_BEARER_TOKEN` environment variables, you can omit the headers entirely.

## 3. Direct HTTP Testing

### List available tools:
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }'
```

### Test a tool (List Devices):
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "X-LM-Account: YOUR_ACCOUNT" \
  -H "X-LM-Bearer-Token: YOUR_BEARER_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "lm_list_devices",
      "arguments": {
        "size": 10
      }
    },
    "id": 2
  }'
```

## 4. Testing with Claude Desktop

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "logicmonitor": {
      "url": "http://localhost:3001/mcp",
      "transport": "http",
      "headers": {
        "X-LM-Account": "YOUR_ACCOUNT",
        "X-LM-Bearer-Token": "YOUR_BEARER_TOKEN"
      }
    }
  }
}
```

Then restart Claude Desktop and you should see the LogicMonitor tools available.

> Tip: if you launch the server with `LM_ACCOUNT` and `LM_BEARER_TOKEN` defined, you can omit the headers block entirely.

## 5. Test Scenarios

### Basic Device Operations:

1. **List devices**:
   - Tool: `lm_list_devices`
   - Test with filters: `filter: "displayName:test*"`

2. **Get specific device**:
   - Tool: `lm_get_device`
   - Requires: `deviceId`

3. **Create a test device**:
   - Tool: `lm_create_device`
   - Required fields: `displayName`, `name`, `hostGroupIds`

### Basic Group Operations:

1. **List device groups**:
   - Tool: `lm_list_device_groups`

2. **Create a test group**:
   - Tool: `lm_create_device_group`
   - Required fields: `name`, `parentId` (use 1 for root)

## 6. Debugging

Enable debug logging by setting:
```bash
export LOG_LEVEL=debug
npm run dev
```

Check the console output for detailed request/response logs.

## Common Issues

1. **Authentication Error**: Verify your bearer token is valid and not expired
2. **Connection Refused**: Check the server is running on the correct port
3. **Invalid Account**: Ensure the account name matches your LogicMonitor portal URL
