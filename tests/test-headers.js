#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const serverUrl = `http://localhost:${process.env.PORT || 3001}/mcp`;
const credentials = {
  lm_account: process.env.LM_ACCOUNT || 'your_account',
  lm_bearer_token: process.env.LM_BEARER_TOKEN || 'your_bearer_token'
};

// Check credentials
if (credentials.lm_account === 'your_account') {
  console.error('Please set LM_ACCOUNT and LM_BEARER_TOKEN in .env file');
  process.exit(1);
}

let sessionId = null;
let requestId = 1;

async function makeRequest(method, params = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    // Pass LogicMonitor credentials as headers
    'X-LM-Account': credentials.lm_account,
    'X-LM-Bearer-Token': credentials.lm_bearer_token
  };
  
  if (sessionId) {
    headers['mcp-session-id'] = sessionId;
  }

  try {
    console.log(`\n→ ${method}`);
    
    const response = await axios.post(serverUrl, {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: requestId++
    }, { headers });
    
    // Store session ID if provided
    if (response.headers['mcp-session-id']) {
      sessionId = response.headers['mcp-session-id'];
      console.log(`📌 Session ID: ${sessionId}`);
    }
    
    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

async function runTest() {
  console.log('🧪 MCP Test with Header Authentication');
  console.log('=====================================\n');
  
  try {
    // Step 1: Initialize
    console.log('1️⃣  Initializing...');
    await makeRequest('initialize', {
      protocolVersion: '0.1.0',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });
    
    // Step 2: List tools
    console.log('\n2️⃣  Listing tools...');
    const toolsResponse = await makeRequest('tools/list');
    console.log(`Found ${toolsResponse.result?.tools?.length || 0} tools`);
    
    // Step 3: Call a tool
    console.log('\n3️⃣  Testing lm_list_devices...');
    await makeRequest('tools/call', {
      name: 'lm_list_devices',
      arguments: {
        size: 5
      }
    });
    
    // Step 4: Test device groups
    console.log('\n4️⃣  Testing lm_list_device_groups...');
    await makeRequest('tools/call', {
      name: 'lm_list_device_groups',
      arguments: {}
    });
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed');
    process.exit(1);
  }
}

runTest();