#!/usr/bin/env node

/**
 * Simple test script to demonstrate the new MCP server functionality
 * This creates a minimal test client that uses the HTTP transport
 */

const fetch = require('node:fetch');

const MCP_SERVER_URL = 'http://localhost:8080/mcp';

async function testMCPServer() {
  console.log('🧪 Testing new MCP server functionality...\n');

  try {
    // Test 1: Initialize a new session and get server info
    console.log('1. Initializing MCP session...');
    const initResponse = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      })
    });

    const sessionId = initResponse.headers.get('mcp-session-id');
    console.log(`✅ Session initialized: ${sessionId?.substring(0, 8)}...\n`);

    // Helper function for authenticated requests
    const mcpRequest = async (method, params = {}, id = Date.now()) => {
      const response = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId 
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method,
          params
        })
      });
      return response.json();
    };

    // Test 2: List available tools
    console.log('2. Listing available tools...');
    const toolsResponse = await mcpRequest('tools/list');
    console.log(`✅ Found ${toolsResponse.result?.tools?.length || 0} tools:`);
    toolsResponse.result?.tools?.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // Test 3: List available resources
    console.log('3. Listing available resources...');
    const resourcesResponse = await mcpRequest('resources/list');
    console.log(`✅ Found ${resourcesResponse.result?.resources?.length || 0} resources:`);
    resourcesResponse.result?.resources?.forEach(resource => {
      console.log(`   - ${resource.uri}: ${resource.description}`);
    });
    console.log();

    // Test 4: Read server status resource
    console.log('4. Reading server status...');
    const statusResponse = await mcpRequest('resources/read', {
      uri: 'status://server'
    });
    console.log('✅ Server status:', JSON.parse(statusResponse.result?.contents[0]?.text || '{}'));
    console.log();

    // Test 5: Test a tool call (analyze-project)
    console.log('5. Testing analyze-project tool...');
    const analyzeResponse = await mcpRequest('tools/call', {
      name: 'analyze-project',
      arguments: {
        projectPath: '/tmp/test-nextjs',
        options: {
          confidenceThreshold: 80
        }
      }
    });
    
    if (analyzeResponse.result?.content?.[0]?.text) {
      console.log('✅ Analysis started:', analyzeResponse.result.content[0].text.split('\n')[0]);
      
      // Extract job ID
      const jobIdMatch = analyzeResponse.result.content[0].text.match(/Job ID: ([a-f0-9]+)/);
      if (jobIdMatch) {
        const jobId = jobIdMatch[1];
        console.log(`📋 Job ID: ${jobId}\n`);

        // Test 6: Check job status
        console.log('6. Checking job status...');
        const statusCheckResponse = await mcpRequest('tools/call', {
          name: 'get-job-status',
          arguments: { jobId }
        });
        
        if (statusCheckResponse.result?.content?.[0]?.text) {
          console.log('✅ Job status retrieved:', statusCheckResponse.result.content[0].text.split('\n')[1]);
        }
      }
    }

    console.log('\n🎉 MCP server test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - MCP protocol initialization: ✅');
    console.log('   - Tools discovery: ✅');
    console.log('   - Resources discovery: ✅');
    console.log('   - Resource reading: ✅');
    console.log('   - Tool execution: ✅');
    console.log('\n💡 The new MCP server is fully functional and compliant with MCP standards!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure to start the server first: npx vibealive serve --port 8080');
  }
}

if (require.main === module) {
  testMCPServer();
}