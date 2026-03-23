/**
 * Test suite for lm_device_group tool
 * Full CRUD operations
 */

import { createTestClient, TestMCPClient } from '../utils/testClient.js';
import {
  assertToolSuccess,
  extractToolData,
  generateTestResourceName,
  isValidLMId,
  retry,
  waitForIndexing,
} from '../utils/testHelpers.js';
import {
  discoverResources,
  createTestDeviceGroup,
  deleteDeviceGroup,
  cleanupTestDeviceGroups,
  DiscoveredResources,
} from '../utils/resourceHelpers.js';
import { generateDeviceGroupPayload } from '../utils/fixtures.js';

describe('lm_device_group', () => {
  let client: TestMCPClient;
  let resources: DiscoveredResources;
  let createdGroupIds: number[] = [];

  beforeAll(async () => {
    client = await createTestClient('lm-device-group-test-session');
    resources = await discoverResources(client);

    console.log('Test environment:');
    console.log(`  - Root Device Group ID: ${resources.rootDeviceGroupId}`);
    console.log(`  - Device Groups: ${resources.deviceGroups.length}`);
  });

  afterAll(async () => {
    // Cleanup created groups
    if (createdGroupIds.length > 0) {
      console.log(`Cleaning up ${createdGroupIds.length} test device group(s)...`);
      for (const groupId of createdGroupIds) {
        try {
          await deleteDeviceGroup(client, groupId, true);
        } catch (error) {
          console.warn(`Failed to delete group ${groupId}:`, error);
        }
      }
    }

    // Additional cleanup
    await cleanupTestDeviceGroups(client);
  });

  describe('List Operations', () => {
    test('should list device groups with default parameters', async () => {
      const result = await client.callTool('lm_device_group', {
        operation: 'list',
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean; items: unknown[]; total: number }>(result);

      expect(data.success).toBe(true);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.total).toBeGreaterThan(0);
    });

    test('should list device groups with size limit', async () => {
      const result = await client.callTool('lm_device_group', {
        operation: 'list',
        size: 5,
        autoPaginate: false,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ items: unknown[] }>(result);

      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeLessThanOrEqual(5);
    });

    test('should list device groups with filter', async () => {
      // Create a test group first
      const testGroup = await createTestDeviceGroup(client, {
        parentId: resources.rootDeviceGroupId,
      });
      createdGroupIds.push(testGroup.id);

      // Wait for group to be indexed before filtering
      await waitForIndexing();

      const result = await client.callTool('lm_device_group', {
        operation: 'list',
        filter: `name:"${testGroup.name}"`,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ items: Array<{ id: number; name: string }> }>(result);

      expect(data.items.some(g => g.id === testGroup.id)).toBe(true);
    });

    test('should list device groups with field selection', async () => {
      const result = await client.callTool('lm_device_group', {
        operation: 'list',
        size: 1000,
        fields: 'id,name,fullPath',
      });

      assertToolSuccess(result);
      const data = extractToolData<{ items: Array<{ id: number; name: string; fullPath: string }> }>(result);

      if (data.items.length > 0) {
        const group = data.items[0];
        expect(group).toHaveProperty('id');
        expect(group).toHaveProperty('name');
        expect(group).toHaveProperty('fullPath');
        expect(group).not.toHaveProperty('description');
      }
    });
  });

  describe('Get Operations', () => {
    let testGroupId: number;

    beforeAll(async () => {
      const group = await createTestDeviceGroup(client, {
        parentId: resources.rootDeviceGroupId,
      });
      testGroupId = group.id;
      createdGroupIds.push(testGroupId);
    });

    test('should get device group by ID', async () => {
      const result = await client.callTool('lm_device_group', {
        operation: 'get',
        id: testGroupId,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean; data: { id: number; name: string } }>(result);

      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testGroupId);
      expect(data.data).toHaveProperty('name');
    });

    test('should get device group with field selection', async () => {
      const result = await client.callTool('lm_device_group', {
        operation: 'get',
        id: testGroupId,
        fields: 'id,name,parentId',
      });

      assertToolSuccess(result);
      const data = extractToolData<{ data: { id: number; name: string; parentId: number } }>(result);

      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('name');
      expect(data.data).toHaveProperty('parentId');
      expect(data.data).not.toHaveProperty('fullPath');
    });
  });

  describe('Create Operations', () => {
    test('should create single device group', async () => {
      const payload = generateDeviceGroupPayload({
        parentId: resources.rootDeviceGroupId,
      });

      const result = await client.callTool('lm_device_group', {
        operation: 'create',
        ...payload,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean; data: { id: number; name: string } }>(result);

      expect(data.success).toBe(true);
      expect(isValidLMId(data.data.id)).toBe(true);
      expect(data.data.name).toBe(payload.name);

      createdGroupIds.push(data.data.id);
    });

    test('should create device group with custom properties', async () => {
      const payload = generateDeviceGroupPayload({
        parentId: resources.rootDeviceGroupId,
      });

      payload.customProperties.push({ name: 'test.custom', value: 'custom-value' });

      const result = await client.callTool('lm_device_group', {
        operation: 'create',
        ...payload,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ data: { id: number } }>(result);

      createdGroupIds.push(data.data.id);
    });

    test('should validate error handling for missing required fields', async () => {
      const result = await client.callTool('lm_device_group', {
        operation: 'create',
        name: 'Invalid Group',
        // Missing: parentId
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Update Operations', () => {
    let testGroupId: number;

    beforeEach(async () => {
      const group = await createTestDeviceGroup(client, {
        parentId: resources.rootDeviceGroupId,
      });
      testGroupId = group.id;
      createdGroupIds.push(testGroupId);
    });

    test('should update single device group', async () => {
      const result = await client.callTool('lm_device_group', {
        operation: 'update',
        id: testGroupId,
        description: 'Updated description',
        customProperties: [
          { name: 'test.updated', value: 'true' },
        ],
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean; data: { id: number } }>(result);

      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testGroupId);
    });

    test('should batch update with filter', async () => {
      const prefix = generateTestResourceName('batch-group');
      const group1 = await createTestDeviceGroup(client, {
        parentId: resources.rootDeviceGroupId,
        name: `${prefix}-1`,
      });
      const group2 = await createTestDeviceGroup(client, {
        parentId: resources.rootDeviceGroupId,
        name: `${prefix}-2`,
      });
      createdGroupIds.push(group1.id, group2.id);

      // Exact names + OR avoids wildcard quirks; poll until list matches (LM search can lag create).
      const batchFilter = `name:"${prefix}-1"||name:"${prefix}-2"`;
      await retry(
        async () => {
          const check = await client.callTool('lm_device_group', {
            operation: 'list',
            filter: batchFilter,
            size: 50,
            autoPaginate: false,
          });
          assertToolSuccess(check);
          const checkData = extractToolData<{ items: Array<{ id: number }> }>(check);
          if ((checkData.items?.length ?? 0) < 2) {
            throw new Error('device groups not yet visible to list/filter');
          }
        },
        { maxAttempts: 15, delayMs: 2000 }
      );

      const result = await client.callTool('lm_device_group', {
        operation: 'update',
        filter: batchFilter,
        updates: {
          description: 'Batch updated',
        },
      });

      assertToolSuccess(result);
      const data = extractToolData<{ 
        success: boolean;
        summary: { succeeded: number };
      }>(result);

      expect(data.success).toBe(true);
      expect(data.summary.succeeded).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Delete Operations', () => {
    test('should delete single device group', async () => {
      const group = await createTestDeviceGroup(client, {
        parentId: resources.rootDeviceGroupId,
      });

      const result = await client.callTool('lm_device_group', {
        operation: 'delete',
        id: group.id,
        deleteChildren: false,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean }>(result);

      expect(data.success).toBe(true);

      // Verify deletion
      const getResult = await client.callTool('lm_device_group', {
        operation: 'get',
        id: group.id,
      });

      expect(getResult.success).toBe(false);
    });

    test('should delete device group with children', async () => {
      // Create parent group
      const parentGroup = await createTestDeviceGroup(client, {
        parentId: resources.rootDeviceGroupId,
      });

      // Create child group
      await createTestDeviceGroup(client, {
        parentId: parentGroup.id,
      });

      // Delete parent with children
      const result = await client.callTool('lm_device_group', {
        operation: 'delete',
        id: parentGroup.id,
        deleteChildren: true,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean }>(result);

      expect(data.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid group ID', async () => {
      const result = await client.callTool('lm_device_group', {
        operation: 'get',
        id: 999999999,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle invalid field names', async () => {
      const result = await client.callTool('lm_device_group', {
        operation: 'list',
        fields: 'id,invalidFieldName',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown');
    });
  });
});

