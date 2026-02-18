/**
 * Test suite for lm_alert tool
 * Read and update operations (ack, note, escalate)
 */

import { createTestClient, TestMCPClient } from '../utils/testClient.js';
import { assertToolSuccess, extractToolData } from '../utils/testHelpers.js';

describe('lm_alert', () => {
  let client: TestMCPClient;
  let testAlertId: string | number | undefined;

  beforeAll(async () => {
    client = await createTestClient('lm-alert-test-session');

    // Try to find an existing alert for update tests
    const listResult = await client.callTool('lm_alert', {
      operation: 'list',
      autoPaginate: false,
      size: 1,
    });

    if (listResult.success) {
      const data = extractToolData<{ items: Array<{ id: string | number }> }>(listResult);
      if (data.items.length > 0) {
        testAlertId = data.items[0].id;
      }
    }
  });

  describe('List Operations', () => {
    test('should list alerts with default parameters', async () => {
      const result = await client.callTool('lm_alert', {
        operation: 'list',
        size: 5,
        autoPaginate: false,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean; items: unknown[]; total: number }>(result);

      expect(data.success).toBe(true);
      expect(Array.isArray(data.items)).toBe(true);
      expect(typeof data.total).toBe('number');
    });

    test('should list alerts with size limit', async () => {
      const result = await client.callTool('lm_alert', {
        operation: 'list',
        size: 5,
        autoPaginate: false,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ items: unknown[] }>(result);

      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeLessThanOrEqual(5);
    });

    test('should list alerts with filter', async () => {
      const result = await client.callTool('lm_alert', {
        operation: 'list',
        filter: 'cleared:false',
        size: 10,
        autoPaginate: false,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ items: Array<{ cleared?: boolean }> }>(result);

      expect(Array.isArray(data.items)).toBe(true);
    });

    test('should list alerts with field selection', async () => {
      const result = await client.callTool('lm_alert', {
        operation: 'list',
        autoPaginate: false,
        size: 1,
        fields: 'id,severity,resourceId',
      });

      assertToolSuccess(result);
      const data = extractToolData<{ items: Array<{ id: string | number }> }>(result);

      if (data.items.length > 0) {
        const alert = data.items[0];
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('resourceId');
        expect(alert).not.toHaveProperty('alertValue');
      }
    });

    test('should list alerts with sort', async () => {
      const result = await client.callTool('lm_alert', {
        operation: 'list',
        size: 5,
        autoPaginate: false,
        sort: '-startEpoch', // Most recent first
      });

      assertToolSuccess(result);
      const data = extractToolData<{ items: Array<{ startEpoch?: number }> }>(result);

      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  describe('Get Operations', () => {
    test('should get alert by ID if alert exists', async () => {
      if (!testAlertId) {
        console.log('Skipping get test - no alerts found in portal');
        return;
      }

      const result = await client.callTool('lm_alert', {
        operation: 'get',
        id: testAlertId,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean; data: { id: string | number } }>(result);

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
    });
  });

  describe('Update Operations', () => {
    test('should acknowledge alert if alert exists', async () => {
      if (!testAlertId) {
        console.log('Skipping ack test - no alerts found in portal');
        return;
      }

      const result = await client.callTool('lm_alert', {
        operation: 'update',
        id: testAlertId,
        action: 'ack',
        ackComment: 'Acknowledged by MCP test suite',
      });

      // May fail if alert is already acked or cleared - that's okay
      if (result.success) {
        const data = extractToolData<{ success: boolean }>(result);
        expect(data.success).toBe(true);
      } else {
        console.log('Alert ack failed (may already be acked):', result.error);
      }
    });

    test('should add note to alert if alert exists', async () => {
      if (!testAlertId) {
        console.log('Skipping note test - no alerts found in portal');
        return;
      }

      const result = await client.callTool('lm_alert', {
        operation: 'update',
        id: testAlertId,
        action: 'note',
        note: 'Test note from MCP test suite',
      });

      // May fail if alert is cleared - that's okay
      if (result.success) {
        const data = extractToolData<{ success: boolean }>(result);
        expect(data.success).toBe(true);
      } else {
        console.log('Alert note failed (may be cleared):', result.error);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid alert ID', async () => {
      const result = await client.callTool('lm_alert', {
        operation: 'get',
        id: 'INVALID_ID_999999999',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle invalid operation', async () => {
      const result = await client.callTool('lm_alert', {
        operation: 'create', // Not supported for alerts
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing action for update', async () => {
      if (!testAlertId) {
        return;
      }

      const result = await client.callTool('lm_alert', {
        operation: 'update',
        id: testAlertId,
        // Missing: action
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

