// examples/mcp-client.ts

/**
 * This is an example client for interacting with the VibeAlive MCP server.
 * It demonstrates how to call the various MCP methods using the built-in fetch API.
 *
 * To run this example:
 * 1. Start the MCP server in one terminal: `npx vibealive serve`
 * 2. Run this client in another terminal: `npx ts-node examples/mcp-client.ts`
 */

const MCP_SERVER_URL = 'http://localhost:8080';

async function callMcpMethod(method: string, params: any = {}) {
  console.log(`\n--- Calling ${method} ---`);
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mcp_version: '1.0',
        method,
        params,
      }),
    });

    const json = await response.json();
    console.log('Response:', JSON.stringify(json, null, 2));
    return json;
  } catch (error) {
    console.error('Error calling MCP method:', error);
  }
}

async function main() {
  // 1. Discover available methods
  await callMcpMethod('mcp.discover');

  // 2. Check server status
  await callMcpMethod('mcp.status');

  // 3. Get help for a specific method
  await callMcpMethod('mcp.help', { method: 'mcp.analyze' });

  // 4. Start an analysis job
  const analyzeResponse = await callMcpMethod('mcp.analyze', {
    projectPath: '/path/to/your/nextjs-project', // IMPORTANT: Change this to a real project path
  });

  if (analyzeResponse && analyzeResponse.result && analyzeResponse.result.jobId) {
    const { jobId } = analyzeResponse.result;
    console.log(`\n--- Polling for job ${jobId} status ---`);

    // 5. Poll for job status
    let jobStatus = '';
    while (jobStatus !== 'completed' && jobStatus !== 'failed') {
      const statusResponse = await callMcpMethod('mcp.status', { jobId });
      jobStatus = statusResponse?.result?.status;
      console.log(`Job status: ${jobStatus}`);
      if (jobStatus !== 'completed' && jobStatus !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      }
    }

    // 6. Get the final report
    if (jobStatus === 'completed') {
      await callMcpMethod('mcp.getReport', { jobId });
    }
  }
}

main();
