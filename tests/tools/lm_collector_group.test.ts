/**
 * Test suite for lm_collector_group tool
 */

import { createTestClient, TestMCPClient } from '../utils/testClient.js';
import {
  assertToolSuccess,
  extractToolData,
  isValidLMId,
} from '../utils/testHelpers.js';
import { generateCollectorGroupPayload } from '../utils/fixtures.js';

describe('lm_collector_group', () => {
  let client: TestMCPClient;
  let createdGroupIds: number[] = [];

  beforeAll(async () => {
    client = await createTestClient('lm-collector-group-test-session');
    
    console.log('Test environment initialized');
  });

  afterAll(async () => {
    // Cleanup all created collector groups
    if (createdGroupIds.length > 0) {
      console.log(`Cleaning up ${createdGroupIds.length} test collector group(s)...`);
      for (const id of createdGroupIds) {
        try {
          await client.callTool('lm_collector_group', {
            operation: 'delete',
            id,
          });
        } catch (error) {
          console.warn(`Failed to delete collector group ${id}:`, error);
        }
      }
    }
  });

  describe('List Operations', () => {
    test('should list collector groups with default parameters', async () => {
      const result = await client.callTool('lm_collector_group', {
        operation: 'list',
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean; items: unknown[]; total: number }>(result);

      expect(data.success).toBe(true);
      expect(Array.isArray(data.items)).toBe(true);
      expect(typeof data.total).toBe('number');
    });

    test('should list collector groups with size limit', async () => {
      const result = await client.callTool('lm_collector_group', {
        operation: 'list',
        size: 5,
        autoPaginate: false,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ items: unknown[] }>(result);

      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeLessThanOrEqual(5);
    });

    test('should list collector groups with field selection', async () => {
      const result = await client.callTool('lm_collector_group', {
        operation: 'list',
        fields: 'id,name,description,autoBalance',
      });

      assertToolSuccess(result);
      const data = extractToolData<{ items: Array<{ id: number; name: string }> }>(result);

      if (data.items.length > 0) {
        const group = data.items[0];
        expect(group).toHaveProperty('id');
        expect(group).toHaveProperty('name');
        expect(group).toHaveProperty('description');
        expect(group).toHaveProperty('autoBalance');
        expect(group).not.toHaveProperty('numOfCollectors');
      }
    });
  });

  describe('Get Operations', () => {
    let testGroupId: number;

    beforeAll(async () => {
      // Create a collector group for get tests
      const payload = generateCollectorGroupPayload();
      const createResult = await client.callTool('lm_collector_group', {
        operation: 'create',
        ...payload,
      });
      
      assertToolSuccess(createResult);
      const createData = extractToolData<{ data: { id: number } }>(createResult);
      testGroupId = createData.data.id;
      createdGroupIds.push(testGroupId);
    });

    test('should get collector group by ID with full fields', async () => {
      const result = await client.callTool('lm_collector_group', {
        operation: 'get',
        id: testGroupId,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean; data: { id: number; name: string } }>(result);

      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testGroupId);
      expect(data.data).toHaveProperty('name');
    });

    test('should get collector group with specific field selection', async () => {
      const result = await client.callTool('lm_collector_group', {
        operation: 'get',
        id: testGroupId,
        fields: 'id,name,description',
      });

      assertToolSuccess(result);
      const data = extractToolData<{ data: { id: number; name: string; description: string } }>(result);

      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('name');
      expect(data.data).toHaveProperty('description');
      expect(data.data).not.toHaveProperty('autoBalance');
    });
  });

  describe('Create Operations', () => {
    test('should create single collector group with required fields', async () => {
      const payload = generateCollectorGroupPayload();

      const result = await client.callTool('lm_collector_group', {
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

    test('should create collector group with custom properties', async () => {
      const customProps = [
        { name: 'test.property1', value: 'value1' },
        { name: 'test.property2', value: 'value2' },
      ];

      const payload = generateCollectorGroupPayload();

      const result = await client.callTool('lm_collector_group', {
        operation: 'create',
        ...payload,
        customProperties: customProps,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ data: { id: number } }>(result);

      expect(isValidLMId(data.data.id)).toBe(true);
      createdGroupIds.push(data.data.id);
    });

    test('should create collector group with auto-balance enabled', async () => {
      const payload = generateCollectorGroupPayload({
        autoBalance: true,
      });

      const result = await client.callTool('lm_collector_group', {
        operation: 'create',
        ...payload,
        autoBalanceInstanceCountThreshold: 10000,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ data: { id: number; autoBalance: boolean } }>(result);

      expect(isValidLMId(data.data.id)).toBe(true);
      createdGroupIds.push(data.data.id);
    });

    test('should create batch of collector groups', async () => {
      const groups = Array.from({ length: 3 }, (_, i) => 
        generateCollectorGroupPayload({
          name: `mcp-test-cg-batch-${Date.now()}-${i}`,
        })
      );

      const result = await client.callTool('lm_collector_group', {
        operation: 'create',
        groups,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ 
        success: boolean; 
        items: Array<{ id: number; name: string }>;
        summary: { total: number; succeeded: number; failed: number };
      }>(result);

      expect(data.success).toBe(true);
      expect(data.items.length).toBe(3);
      expect(data.summary.succeeded).toBe(3);
      expect(data.summary.failed).toBe(0);

      data.items.forEach(group => createdGroupIds.push(group.id));
    });

    test('should validate error handling for missing required fields', async () => {
      // Create schema requires `name` when `groups` is not provided; description is optional (matches LM API).
      const result = await client.callTool('lm_collector_group', {
        operation: 'create',
        description: 'Missing required name',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Update Operations', () => {
    let testGroupId: number;

    beforeEach(async () => {
      const payload = generateCollectorGroupPayload();
      const createResult = await client.callTool('lm_collector_group', {
        operation: 'create',
        ...payload,
      });
      
      assertToolSuccess(createResult);
      const createData = extractToolData<{ data: { id: number } }>(createResult);
      testGroupId = createData.data.id;
      createdGroupIds.push(testGroupId);
    });

    test('should update single collector group', async () => {
      const result = await client.callTool('lm_collector_group', {
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

    test('should batch update with explicit array of groups', async () => {
      const group2Payload = generateCollectorGroupPayload();
      const group2Result = await client.callTool('lm_collector_group', {
        operation: 'create',
        ...group2Payload,
      });
      assertToolSuccess(group2Result);
      const group2Data = extractToolData<{ data: { id: number } }>(group2Result);
      const group2Id = group2Data.data.id;
      createdGroupIds.push(group2Id);

      const result = await client.callTool('lm_collector_group', {
        operation: 'update',
        groups: [
          { id: testGroupId, description: 'Batch updated 1' },
          { id: group2Id, description: 'Batch updated 2' },
        ],
      });

      assertToolSuccess(result);
      const data = extractToolData<{ 
        success: boolean;
        summary: { total: number; succeeded: number };
      }>(result);

      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(2);
      expect(data.summary.succeeded).toBe(2);
    });
  });

  describe('Delete Operations', () => {
    test('should delete single collector group by ID', async () => {
      const payload = generateCollectorGroupPayload();
      const createResult = await client.callTool('lm_collector_group', {
        operation: 'create',
        ...payload,
      });
      
      assertToolSuccess(createResult);
      const createData = extractToolData<{ data: { id: number } }>(createResult);
      const groupId = createData.data.id;

      const result = await client.callTool('lm_collector_group', {
        operation: 'delete',
        id: groupId,
      });

      assertToolSuccess(result);
      const data = extractToolData<{ success: boolean }>(result);

      expect(data.success).toBe(true);

      // Verify deletion
      const getResult = await client.callTool('lm_collector_group', {
        operation: 'get',
        id: groupId,
      });

      expect(getResult.success).toBe(false);
    });

    test('should batch delete using explicit IDs', async () => {
      const group1Payload = generateCollectorGroupPayload();
      const group1Result = await client.callTool('lm_collector_group', {
        operation: 'create',
        ...group1Payload,
      });
      assertToolSuccess(group1Result);
      const group1Data = extractToolData<{ data: { id: number } }>(group1Result);
      const group1Id = group1Data.data.id;

      const group2Payload = generateCollectorGroupPayload();
      const group2Result = await client.callTool('lm_collector_group', {
        operation: 'create',
        ...group2Payload,
      });
      assertToolSuccess(group2Result);
      const group2Data = extractToolData<{ data: { id: number } }>(group2Result);
      const group2Id = group2Data.data.id;

      const result = await client.callTool('lm_collector_group', {
        operation: 'delete',
        ids: [group1Id, group2Id],
      });

      assertToolSuccess(result);
      const data = extractToolData<{ 
        success: boolean;
        summary: { total: number; succeeded: number };
      }>(result);

      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(2);
      expect(data.summary.succeeded).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid collector group ID', async () => {
      const result = await client.callTool('lm_collector_group', {
        operation: 'get',
        id: 999999999,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle invalid operation', async () => {
      const result = await client.callTool('lm_collector_group', {
        operation: 'invalid_operation',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

