// import { McpServer } from '../mcp/server';
// import { JobManager } from '../mcp/job-manager';
// import { startMCPServerHTTP } from '../mcp/server';
import * as path from 'node:path';
import * as fs from 'fs-extra';

// import { Server } from 'http';

describe('MCP Server', () => {
  // Integration tests that would start a real MCP server for testing
  // Currently skipped due to ESM module compatibility issues with Jest
  const testProjectPath = path.join(__dirname, 'fixtures', 'test-mcp-project');
  let serverPort: number;
  let baseUrl: string;
  // let serverInstance: Server | null = null;

  beforeAll(async () => {
    // Create test project structure for MCP tests
    await fs.ensureDir(testProjectPath);
    await fs.ensureDir(path.join(testProjectPath, 'app'));
    await fs.ensureDir(path.join(testProjectPath, 'components'));

    // Create package.json
    await fs.writeJson(path.join(testProjectPath, 'package.json'), {
      name: 'test-mcp-project',
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
      },
    });

    // Create test files
    await fs.writeFile(
      path.join(testProjectPath, 'app', 'page.tsx'),
      `export default function HomePage() {
        return <div>Home</div>;
      }`
    );

    await fs.writeFile(
      path.join(testProjectPath, 'components', 'Button.tsx'),
      `export default function Button() {
        return <button>Click me</button>;
      }`
    );

    await fs.writeFile(
      path.join(testProjectPath, 'components', 'UnusedComponent.tsx'),
      `export default function UnusedComponent() {
        return <div>Never used</div>;
      }`
    );

    // Setup server configuration (tests are skipped due to ESM module issues)
    serverPort = 8081 + Math.floor(Math.random() * 1000);
    baseUrl = `http://localhost:${serverPort}/mcp`;
  });

  afterAll(async () => {
    // Clean up test files
    await fs.remove(testProjectPath);
  });

  describe.skip('MCP Protocol Compliance', () => {
    let sessionId: string;

    it('should initialize MCP session correctly', async () => {
      const response = await fetch(baseUrl, {
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
              version: '1.0.0',
            },
          },
        }),
      });

      expect(response.ok).toBe(true);
      sessionId = response.headers.get('mcp-session-id') || '';
      expect(sessionId).toBeTruthy();
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should list available tools', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as any;
      expect(data.result?.tools).toBeDefined();
      expect(Array.isArray(data.result.tools)).toBe(true);

      // Should include the analyze-project tool
      const analyzeProjectTool = data.result.tools.find(
        (tool: any) => tool.name === 'analyze-project'
      );
      expect(analyzeProjectTool).toBeDefined();
      expect(analyzeProjectTool.description).toContain('analyze');
    });

    it('should list available resources', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'resources/list',
          params: {},
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as any;
      expect(data.result?.resources).toBeDefined();
      expect(Array.isArray(data.result.resources)).toBe(true);

      // Should include the server status resource
      const statusResource = data.result.resources.find(
        (resource: any) => resource.uri === 'status://server'
      );
      expect(statusResource).toBeDefined();
    });

    it('should read server status resource', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'resources/read',
          params: {
            uri: 'status://server',
          },
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as any;
      expect(data.result?.contents).toBeDefined();
      expect(Array.isArray(data.result.contents)).toBe(true);
      expect(data.result.contents.length).toBeGreaterThan(0);

      const statusContent = JSON.parse(data.result.contents[0].text);
      expect(statusContent.status).toBe('running');
    });
  });

  describe.skip('Analysis Tools', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Initialize session for each test
      const response = await fetch(baseUrl, {
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
              version: '1.0.0',
            },
          },
        }),
      });
      sessionId = response.headers.get('mcp-session-id') || '';
    });

    it('should start project analysis', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'analyze-project',
            arguments: {
              projectPath: testProjectPath,
              options: {
                confidenceThreshold: 80,
              },
            },
          },
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as any;
      expect(data.result?.content).toBeDefined();
      expect(Array.isArray(data.result.content)).toBe(true);
      expect(data.result.content[0]?.text).toContain('Analysis started');

      // Extract job ID for further testing
      const jobIdMatch = data.result.content[0].text.match(/Job ID: ([a-f0-9-]+)/);
      expect(jobIdMatch).toBeTruthy();
      expect(jobIdMatch![1]).toBeTruthy();
    }, 10000);

    it('should check job status', async () => {
      // First start an analysis
      const analyzeResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: {
            name: 'analyze-project',
            arguments: {
              projectPath: testProjectPath,
              options: {
                confidenceThreshold: 80,
              },
            },
          },
        }),
      });

      const analyzeData = (await analyzeResponse.json()) as any;
      const jobIdMatch = analyzeData.result.content[0].text.match(/Job ID: ([a-f0-9-]+)/);
      const jobId = jobIdMatch![1];

      // Now check the job status
      const statusResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: {
            name: 'get-job-status',
            arguments: { jobId },
          },
        }),
      });

      expect(statusResponse.ok).toBe(true);
      const statusData = (await statusResponse.json()) as any;
      expect(statusData.result?.content).toBeDefined();
      expect(statusData.result.content[0]?.text).toContain('Status:');
    }, 10000);
  });

  describe.skip('Error Handling', () => {
    let sessionId: string;

    beforeEach(async () => {
      const response = await fetch(baseUrl, {
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
              version: '1.0.0',
            },
          },
        }),
      });
      sessionId = response.headers.get('mcp-session-id') || '';
    });

    it('should handle invalid tool calls gracefully', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 8,
          method: 'tools/call',
          params: {
            name: 'non-existent-tool',
            arguments: {},
          },
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as any;
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe(-32601); // Method not found
    });

    it('should handle missing session ID', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 9,
          method: 'tools/list',
          params: {},
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should handle invalid project path', async () => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: {
            name: 'analyze-project',
            arguments: {
              projectPath: '/non/existent/path',
              options: {},
            },
          },
        }),
      });

      expect(response.ok).toBe(true);
      const data = (await response.json()) as any;
      expect(data.result?.content?.[0]?.text).toContain('Error');
    });
  });
});
