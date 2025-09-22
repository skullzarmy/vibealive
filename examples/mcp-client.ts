// examples/mcp-client.ts

/**
 * This is an example client for interacting with the VibeAlive MCP server using the official MCP SDK.
 * It demonstrates how to call the various MCP tools using the standardized MCP protocol.
 *
 * To run this example:
 * 1. Start the MCP server in one terminal: `npx vibealive serve --stdio`
 * 2. Run this client in another terminal: `npx ts-node examples/mcp-client.ts`
 * 
 * For HTTP mode:
 * 1. Start the MCP server: `npx vibealive serve` (defaults to port 8080)
 * 2. Modify the transport below to use HTTP instead of stdio
 */

// Using require for better compatibility with the MCP SDK
const { Client } = require('@modelcontextprotocol/sdk/client');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp');

// Choose transport method
const USE_STDIO = true; // Set to false to use HTTP transport
const MCP_SERVER_URL = 'http://localhost:8080/mcp';

async function createClient() {
  const client = new Client({
    name: 'vibealive-example-client',
    version: '1.0.0',
  });

  let transport: typeof StdioClientTransport | typeof StreamableHTTPClientTransport;
  
  if (USE_STDIO) {
    // Stdio transport for direct connection
    transport = new StdioClientTransport({
      command: 'npx',
      args: ['vibealive', 'serve', '--stdio'],
    });
  } else {
    // HTTP transport for remote connection
    transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));
  }

  await client.connect(transport);
  return client;
}

async function main() {
  console.log('🚀 Connecting to VibeAlive MCP server...');
  
  try {
    const client = await createClient();
    console.log('✅ Connected to MCP server');

    // 1. List available tools
    console.log('\n--- Listing available tools ---');
    const tools = await client.listTools();
    console.log('Available tools:');
    tools.tools.forEach((tool: { name: string; description: string }) => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });

    // 2. List available resources
    console.log('\n--- Listing available resources ---');
    const resources = await client.listResources();
    console.log('Available resources:');
    interface Resource {
      name: string;
      description: string;
    }

    resources.resources.forEach((resource: Resource) => {
      console.log(`- ${resource.name}: ${resource.description}`);
    });

    // 3. Read server status resource
    console.log('\n--- Reading server status ---');
    const serverStatus = await client.readResource({
      uri: 'status://server'
    });
    console.log('Server status:', serverStatus.contents[0].text);

    // 4. Start an analysis job (IMPORTANT: Change this to a real project path)
    const projectPath = process.cwd(); // Using current directory as example
    console.log(`\n--- Starting analysis for ${projectPath} ---`);
    
    const analyzeResponse = await client.callTool({
      name: 'analyze-project',
      arguments: {
        projectPath,
        options: {
          exclude: ['**/node_modules/**', '**/dist/**'],
          confidenceThreshold: 80,
        },
      },
    });

    console.log('Analysis started:', analyzeResponse.content[0].text);

    // Extract job ID from response
    const jobIdMatch = analyzeResponse.content[0].text?.match(/Job ID: ([a-f0-9]+)/);
    if (!jobIdMatch) {
      console.error('Could not extract job ID from response');
      return;
    }
    
    const jobId = jobIdMatch[1];
    console.log(`📋 Job ID: ${jobId}`);

    // 5. Poll for job status
    console.log('\n--- Polling for job status ---');
    let jobStatus = '';
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts with 2-second intervals = 1 minute max

    while (jobStatus !== 'completed' && jobStatus !== 'failed' && attempts < maxAttempts) {
      const statusResponse = await client.callTool({
        name: 'get-job-status',
        arguments: { jobId },
      });

      console.log('Status update:', statusResponse.content[0].text);
      
      // Extract status from response
      const statusMatch = statusResponse.content[0].text?.match(/Status: (\w+)/);
      jobStatus = statusMatch ? statusMatch[1] : '';

      if (jobStatus === 'completed' || jobStatus === 'failed') {
        break;
      }

      attempts++;
      console.log(`⏱️  Waiting... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }

    // 6. Get the final report
    if (jobStatus === 'completed') {
      console.log('\n--- Getting analysis report summary ---');
      const reportResponse = await client.callTool({
        name: 'get-analysis-report',
        arguments: { 
          jobId,
          format: 'summary' 
        },
      });
      console.log('Analysis Report:\n', reportResponse.content[0].text);

      // 7. Get detailed JSON report (optional - can be large)
      console.log('\n--- Getting first part of detailed JSON report ---');
      const detailedResponse = await client.callTool({
        name: 'get-analysis-report',
        arguments: { 
          jobId,
          format: 'json' 
        },
      });
      
      // Show just first 1000 characters of the JSON to avoid overwhelming output
      const jsonReport = detailedResponse.content[0].text || '';
      console.log('Detailed JSON Report (first 1000 chars):\n', jsonReport.substring(0, 1000) + '...');

    } else if (jobStatus === 'failed') {
      console.error('❌ Analysis failed');
    } else {
      console.error('⏰ Analysis timed out');
    }

    // Close the connection
    await client.close();
    console.log('\n✅ MCP client session completed');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
