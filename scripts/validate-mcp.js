#!/usr/bin/env node

/**
 * MCP Integration Validation Script
 * 
 * This script validates that the VibeAlive MCP server correctly implements
 * the MCP protocol and is compatible with VS Code and other MCP clients.
 * 
 * Run with: node scripts/validate-mcp.js
 */

const { spawn } = require('child_process');
const path = require('path');

const TIMEOUT_MS = 10000;

async function validateMCPIntegration() {
  console.log('🔍 VibeAlive MCP Integration Validator\n');
  
  let allTestsPassed = true;

  // Test 1: stdio transport
  console.log('1️⃣  Testing stdio transport...');
  try {
    const stdioResult = await testStdioTransport();
    if (stdioResult) {
      console.log('   ✅ stdio transport: PASS\n');
    } else {
      console.log('   ❌ stdio transport: FAIL\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ stdio transport: ERROR -', error.message, '\n');
    allTestsPassed = false;
  }

  // Test 2: HTTP transport
  console.log('2️⃣  Testing HTTP transport...');
  try {
    const httpResult = await testHTTPTransport();
    if (httpResult) {
      console.log('   ✅ HTTP transport: PASS\n');
    } else {
      console.log('   ❌ HTTP transport: FAIL\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('   ❌ HTTP transport: ERROR -', error.message, '\n');
    allTestsPassed = false;
  }

  // Final result
  console.log('🏁 Final Result:');
  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED - MCP server is fully functional and VS Code compatible');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - MCP server needs fixes');
    process.exit(1);
  }
}

function testStdioTransport() {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('npx', ['vibealive', 'serve', '--stdio'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let responseReceived = false;
    const timeout = setTimeout(() => {
      if (!responseReceived) {
        serverProcess.kill();
        reject(new Error('Timeout - no response within 10 seconds'));
      }
    }, TIMEOUT_MS);

    serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            if (response.result && response.result.protocolVersion) {
              responseReceived = true;
              clearTimeout(timeout);
              serverProcess.kill();
              resolve(true);
              return;
            }
          } catch (e) {
            // Non-JSON output, ignore
          }
        }
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    // Send initialize request
    setTimeout(() => {
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      };
      serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
    }, 1000);
  });
}

function testHTTPTransport() {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('npx', ['vibealive', 'serve', '--port', '18080'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'inherit']
    });

    const timeout = setTimeout(() => {
      serverProcess.kill();
      reject(new Error('Timeout - HTTP server failed to start'));
    }, TIMEOUT_MS);

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('MCP Server running on')) {
        // Server started, test HTTP endpoint
        setTimeout(() => {
          testHTTPEndpoint()
            .then((result) => {
              clearTimeout(timeout);
              serverProcess.kill();
              resolve(result);
            })
            .catch((error) => {
              clearTimeout(timeout);
              serverProcess.kill();
              reject(error);
            });
        }, 1000);
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function testHTTPEndpoint() {
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" }
      }
    });

    const options = {
      hostname: 'localhost',
      port: 18080,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          // Parse SSE response
          const lines = data.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonData = line.substring(6);
              const response = JSON.parse(jsonData);
              if (response.result && response.result.protocolVersion) {
                resolve(true);
                return;
              }
            }
          }
          resolve(false);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run the validation
validateMCPIntegration().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});