#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration from environment
const CONFIG = {
  serverUrl: `http://localhost:${process.env.PORT || 3001}/mcp`,
  lmAccount: process.env.LM_ACCOUNT || 'your_account',
  lmBearerToken: process.env.LM_BEARER_TOKEN || 'your_bearer_token'
};

let sessionId = null;
let requestId = 1;

async function makeRequest(method, params = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    // Pass credentials via headers
    'X-LM-Account': CONFIG.lmAccount,
    'X-LM-Bearer-Token': CONFIG.lmBearerToken
  };
  
  if (sessionId) {
    headers['mcp-session-id'] = sessionId;
  }

  const request = {
    jsonrpc: '2.0',
    method: method,
    params: params,
    id: requestId++
  };

  try {
    console.log(`\n→ ${method}:`, JSON.stringify(params, null, 2));
    
    const response = await axios.post(CONFIG.serverUrl, request, { headers });
    
    // Extract session ID from response headers if present
    if (response.headers['mcp-session-id']) {
      sessionId = response.headers['mcp-session-id'];
      console.log(`Session ID: ${sessionId}`);
    }
    
    // Check if response is SSE format
    if (typeof response.data === 'string' && response.data.includes('event:')) {
      // Parse SSE response
      const lines = response.data.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Check if it's an error response
            if (data.error) {
              console.log('← Error:', JSON.stringify(data.error, null, 2));
              throw new Error(data.error.message);
            }
            
            // For successful responses, show the result
            if (data.result) {
              console.log('← Success:', JSON.stringify(data.result, null, 2));
              return data;
            }
            
            // For other responses, show the full data
            console.log('← Response:', JSON.stringify(data, null, 2));
            return data;
          } catch (e) {
            console.error('Failed to parse SSE data:', line);
          }
        }
      }
    } else {
      console.log('← Response:', JSON.stringify(response.data, null, 2));
      return response.data;
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🧪 LogicMonitor MCP Server Test Client');
  console.log('=====================================\n');

  try {
    // Test 1: Initialize connection
    console.log('1️⃣  Initializing connection...');
    await makeRequest('initialize', {
      protocolVersion: '0.1.0',
      capabilities: {},
      clientInfo: {
        name: 'lm-test-client',
        version: '1.0.0'
      }
    });

    // Test 2: List available tools
    console.log('\n2️⃣  Listing available tools...');
    const toolsResponse = await makeRequest('tools/list');
    console.log(`Found ${toolsResponse.result?.tools?.length || 0} tools`);

    // Test 3: List devices
    console.log('\n3️⃣  Testing lm_list_devices...');
    await makeRequest('tools/call', {
      name: 'lm_list_devices',
      arguments: {
        size: 5
      }
    });

    // Test 4: List device groups
    console.log('\n4️⃣  Testing lm_list_device_groups...');
    await makeRequest('tools/call', {
      name: 'lm_list_device_groups',
      arguments: {}
    });

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Check if credentials are configured
if (CONFIG.lmAccount === 'your_account' || CONFIG.lmBearerToken === 'your_bearer_token') {
  console.error('❗ Please configure your LogicMonitor credentials');
  console.error('   Option 1: Set environment variables:');
  console.error('     export LM_ACCOUNT=your_actual_account');
  console.error('     export LM_BEARER_TOKEN=your_actual_token');
  console.error('   Option 2: Copy .env.example to .env and update the values:');
  console.error('     cp .env.example .env');
  console.error('     # Then edit .env with your credentials');
  process.exit(1);
}

// Run the tests
runTests();