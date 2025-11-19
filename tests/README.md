# LogicMonitor MCP Server - Test Suite

This directory contains the test suite for the LogicMonitor MCP server. Tests are written using Jest and TypeScript, with full integration testing against a live LogicMonitor portal.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing New Tests](#writing-new-tests)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Troubleshooting](#troubleshooting)

## Prerequisites

1. **Node.js**: Version 22.x or 24.x
2. **LogicMonitor Account**: Active account with API access
3. **API Credentials**: Bearer token with appropriate permissions
4. **Test Resources**: At least one active collector in your portal

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
LM_ACCOUNT=your-account-name
LM_BEARER_TOKEN=your-bearer-token
LOG_LEVEL=error
CLEANUP_ON_FAILURE=true
```

**Environment Variables:**

- `LM_ACCOUNT` (required): Your LogicMonitor account name
- `LM_BEARER_TOKEN` (required): Your API bearer token
- `LOG_LEVEL` (optional): Logging level (debug, info, error) - default: error
- `CLEANUP_ON_FAILURE` (optional): Clean up test resources even if tests fail - default: true

### 3. Build the Project

```bash
npm run build
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Run with Coverage

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npm test -- tests/tools/lm_device.test.ts
```

### Run Tests with Verbose Output

```bash
npm test -- --verbose
```

## Test Structure

```
tests/
├── README.md                 # This file
├── setup.ts                  # Global test setup
├── global.d.ts              # TypeScript type definitions
├── utils/                   # Test utilities
│   ├── testClient.ts        # MCP client wrapper
│   ├── testHelpers.ts       # Common helper functions
│   ├── resourceHelpers.ts   # Resource discovery & cleanup
│   └── fixtures.ts          # Test data generators
└── tools/                   # Tool test suites
    ├── lm_device.test.ts    # Device tool tests (reference)
    ├── lm_device_group.test.ts
    ├── lm_collector.test.ts
    ├── lm_alert.test.ts
    └── ...
```

## Test Patterns

### Test Lifecycle

Each test suite follows this pattern:

1. **beforeAll**: 
   - Create test client
   - Discover portal resources (collectors, groups, etc.)
   - Verify prerequisites

2. **Test Execution**:
   - Create test resources as needed
   - Execute operations
   - Verify results
   - Track created resources

3. **afterAll**:
   - Clean up all created test resources
   - Verify cleanup

### Resource Naming Convention

All test resources use the prefix `mcp-test-{resource}-{timestamp}`:

```typescript
// Example: mcp-test-device-1234567890
const deviceName = generateTestResourceName('device');
```

This enables:
- Easy identification of test resources
- Automatic cleanup of orphaned resources
- Prevention of conflicts in parallel test runs

### Dynamic Resource Discovery

Tests query the portal for required resources instead of hardcoding IDs:

```typescript
// Discover collectors
const resources = await discoverResources(client);
const collectorId = resources.collectors[0].id;

// Use in test
const device = await createTestDevice(client, {
  collectorId: collectorId,
});
```

## Writing New Tests

### 1. Create Test File

Create a new file in `tests/tools/` following the naming pattern `lm_{tool_name}.test.ts`:

```typescript
// tests/tools/lm_example.test.ts
import { createTestClient, TestMCPClient } from '../utils/testClient.js';
import { assertToolSuccess, extractToolData } from '../utils/testHelpers.js';

describe('lm_example', () => {
  let client: TestMCPClient;

  beforeAll(async () => {
    client = await createTestClient('example-test-session');
  });

  test('should perform operation', async () => {
    const result = await client.callTool('lm_example', {
      operation: 'list',
    });

    assertToolSuccess(result);
    const data = extractToolData(result);
    
    expect(data.success).toBe(true);
  });
});
```

### 2. Follow the Reference Pattern

Use `tests/tools/lm_device.test.ts` as the reference implementation. It demonstrates:

- Resource discovery
- Create/Read/Update/Delete operations
- Batch operations
- Session context integration
- Error handling
- Proper cleanup

### 3. Test Organization

Organize tests by operation type:

```typescript
describe('lm_tool', () => {
  describe('List Operations', () => {
    // List tests
  });

  describe('Get Operations', () => {
    // Get tests
  });

  describe('Create Operations', () => {
    // Create tests
  });

  describe('Update Operations', () => {
    // Update tests
  });

  describe('Delete Operations', () => {
    // Delete tests
  });

  describe('Error Handling', () => {
    // Error tests
  });
});
```

### 4. Use Test Utilities

Leverage the provided utilities:

```typescript
// Create test client
const client = await createTestClient();

// Generate test data
const payload = generateDevicePayload({ collectorId: 1 });

// Assert success
assertToolSuccess(result);

// Extract data
const data = extractToolData<ExpectedType>(result);

// Retry on transient failures
await retry(async () => {
  // operation
});

// Wait for condition
await waitFor(() => condition);
```

## GitHub Actions CI/CD

### Workflow Configuration

The test suite runs automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

Workflow file: `.github/workflows/test.yml`

### Required Secrets

Configure these secrets in your GitHub repository settings:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add the following secrets:
   - `LM_ACCOUNT`: Your LogicMonitor account name
   - `LM_BEARER_TOKEN`: Your API bearer token

### Viewing Test Results

1. Navigate to the **Actions** tab in your repository
2. Click on a workflow run
3. View test results and logs
4. Download artifacts for detailed coverage reports

## Troubleshooting

### Missing Environment Variables

**Error**: `Warning: Missing environment variables: LM_ACCOUNT, LM_BEARER_TOKEN`

**Solution**: Create a `.env` file with your credentials or set environment variables:

```bash
export LM_ACCOUNT=your-account
export LM_BEARER_TOKEN=your-token
npm test
```

### No Active Collectors

**Error**: `No active collectors found in portal. Cannot run device tests.`

**Solution**: Ensure your LogicMonitor portal has at least one active collector.

### Rate Limiting

**Error**: `Rate limit exceeded` or `429` errors

**Solution**: Tests include automatic retry with exponential backoff. If issues persist:
- Reduce test concurrency
- Increase delays between operations
- Contact LogicMonitor support to increase rate limits

### Test Cleanup Failures

**Issue**: Test resources not cleaned up after test failures

**Solution**: 
1. Set `CLEANUP_ON_FAILURE=true` in your environment
2. Manually clean up using the portal or API
3. Run cleanup script:

```bash
# List test resources
npm test -- tests/tools/lm_device.test.ts --testNamePattern="cleanup"
```

### TypeScript/ESM Issues

**Error**: Module resolution or import errors

**Solution**: Ensure you're using Node.js 18+ with ESM support:

```bash
node --version  # Should be 18.x or 20.x
npm run build   # Rebuild TypeScript
npm test        # Run tests
```

### Permission Errors

**Error**: `403 Forbidden` or insufficient permissions

**Solution**: Verify your API token has the required permissions:
- Read access: collectors, devices, device groups
- Write access: devices, device groups (for create/update/delete tests)

## Best Practices

1. **Always Clean Up**: Ensure test resources are deleted in `afterAll` hooks
2. **Use Unique Names**: Generate unique resource names with timestamps
3. **Test Isolation**: Each test should be independently runnable
4. **Dynamic Discovery**: Query portal for resources instead of hardcoding IDs
5. **Error Handling**: Test both success and failure scenarios
6. **Documentation**: Comment complex test logic
7. **Assertions**: Use descriptive assertion messages

## Contributing

When adding new tests:

1. Follow the existing patterns in `lm_device.test.ts`
2. Include tests for all supported operations
3. Test error conditions
4. Ensure proper cleanup
5. Update this README if adding new patterns or utilities

## Support

For issues or questions:
- Check existing test files for examples
- Review the main project README
- Open an issue in the repository

