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

async function testStdio() {
  console.log('🧪 Testing stdio mode (simpler approach)\n');
  
  try {
    const { spawn } = await import('child_process');
    
    // Start server in stdio mode
    console.log('Starting server in stdio mode...');
    const server = spawn('node', ['dist/index.js', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let buffer = '';
    
    // Handle server output
    server.stdout.on('data', (data) => {
      buffer += data.toString();
      
      // Try to parse complete JSON messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            console.log('← Server:', JSON.stringify(message, null, 2));
          } catch (e) {
            console.log('← Server (raw):', line);
          }
        }
      }
    });
    
    server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });
    
    // Send requests
    const sendRequest = (method, params = {}) => {
      const request = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: Math.floor(Math.random() * 1000000)
      };
      
      // For tool calls, we need to modify our approach
      // In stdio mode, credentials might need to be configured differently
      
      console.log('→ Client:', JSON.stringify(request, null, 2));
      server.stdin.write(JSON.stringify(request) + '\n');
    };
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test sequence
    sendRequest('initialize', {
      protocolVersion: '0.1.0',
      capabilities: {}
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    sendRequest('tools/list');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Note: For stdio mode, we need a different approach for credentials
    console.log('\n⚠️  Note: stdio mode requires different credential handling');
    console.log('For production use, use HTTP mode with headers');
    
    // Clean up
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function testDirectPost() {
  console.log('🧪 Testing direct POST without session\n');
  
  try {
    // Try a direct tools/list without initialization
    const response = await axios.post(serverUrl, {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'X-LM-Account': credentials.lm_account,
        'X-LM-Bearer-Token': credentials.lm_bearer_token
      }
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\n✅ Direct POST works! The server might be running in stateless mode.');
    
  } catch (error) {
    console.error('Direct POST failed:', error.response?.data || error.message);
    console.log('\n💡 Trying stdio mode instead...\n');
    await testStdio();
  }
}

// Run tests
testDirectPost();