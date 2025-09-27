# VibeAlive MCP Server Documentation

The VibeAlive MCP server exposes Next.js analysis capabilities through the standardized Model Context Protocol (MCP). Built with the official MCP SDK v1.18.1, it provides seamless integration with IDEs, LLMs, and automation tools.

## Overview

**Key Features:**

- ✅ **Official MCP SDK**: Built with @modelcontextprotocol/sdk v1.18.1
- ✅ **Multiple Transports**: Supports both stdio and HTTP transports
- ✅ **Standardized Protocol**: Full MCP compliance for universal compatibility
- ✅ **Async Job Management**: Long-running analysis with progress tracking
- ✅ **Rich Tool Set**: 15+ analysis tools and resources

## MCP Tools

### Core Analysis Tools

- **`analyze-project`**: Start a full, asynchronous Next.js project analysis
- **`get-job-status`**: Check analysis progress and status
- **`get-analysis-report`**: Retrieve analysis results (summary or full JSON)
- **`get-file-details`**: Get detailed analysis for specific files
- **`check-file`**: Quickly check if a specific file is used without full analysis

### Focused Analysis Tools

- **`analyze-theme-setup`**: Analyze theme configuration and dark mode setup
- **`audit-seo-setup`**: Comprehensive SEO audit including metadata and structured data
- **`scan-performance-issues`**: Identify performance problems and optimization opportunities
- **`check-accessibility`**: Scan for accessibility issues and ARIA problems
- **`detect-nextjs-patterns`**: Identify advanced Next.js routing patterns
- **`validate-project-health`**: Overall project health score with recommendations

### Specialized Scanners

- **`scan-api-routes`**: Analyze only API routes for unused endpoints
- **`scan-component-tree`**: Analyze component dependencies and impact
- **`scan-directory`**: Analyze files within specific directories

## Transport Options

### 1. Stdio Transport (Recommended for CLI)

For direct integration with MCP clients:

```bash
npx vibealive serve --stdio
```

### 2. HTTP Transport (For Remote Access)

For web-based clients and remote access:

```bash
npx vibealive serve --port 8080
```

The HTTP server provides:

- **Endpoint**: `http://localhost:8080/mcp`
- **Session Management**: Automatic session handling
- **CORS Support**: Configurable for browser clients

## MCP Resources

### `server-status`

**URI**: `status://server`

Provides current server status including version, active jobs, and system information.

## Client Integration Examples

### Using the Official MCP SDK

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({
  name: 'my-client',
  version: '1.0.0',
});

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['vibealive', 'serve', '--stdio'],
});

await client.connect(transport);

// Start analysis
const result = await client.callTool({
  name: 'analyze-project',
  arguments: { projectPath: '/my/project' },
});

// Check status
const status = await client.callTool({
  name: 'get-job-status',
  arguments: { jobId: result.jobId },
});
```

### HTTP Client Example

```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport(new URL('http://localhost:8080/mcp'));
await client.connect(transport);
```

## IDE Configuration

### VS Code / GitHub Copilot

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "vibealive": {
      "type": "stdio",
      "command": "npx",
      "args": ["vibealive", "serve", "--stdio"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Alternative Package Managers

```json
{
  "servers": {
    "vibealive": {
      "type": "stdio",
      "command": "bunx",
      "args": ["vibealive", "serve", "--stdio"]
    }
  }
}
```

### HTTP Configuration

```json
{
  "servers": {
    "vibealive-http": {
      "type": "http",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

### Environment Variables

```json
{
  "servers": {
    "vibealive": {
      "type": "stdio",
      "command": "npx",
      "args": ["vibealive", "serve", "--stdio"],
      "env": {
        "VIBEALIVE_LOG_LEVEL": "info",
        "VIBEALIVE_MAX_JOBS": "5"
      }
    }
  }
}
```

## Job Lifecycle

1. **Start Analysis**: Call `analyze-project` tool
2. **Get Job ID**: Extract job ID from response
3. **Poll Status**: Use `get-job-status` to monitor progress
4. **Get Results**: Call `get-analysis-report` when completed

## Error Handling

The server follows MCP standard error responses:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid parameters",
    "data": { "details": "Missing required parameter: projectPath" }
  },
  "id": null
}
```

## Security Considerations

- **Local-First**: Server binds to localhost by default
- **Session Management**: Secure session handling for HTTP transport
- **Input Validation**: All parameters validated using Zod schemas
- **Error Boundary**: Comprehensive error handling and reporting

🚨 **Security Note**: The MCP server is designed for **local use only**. Do not expose to public internet without proper authentication and security measures.

## Troubleshooting

**Common Issues:**

1. **Command not found**: Ensure Node.js and npm are installed
2. **Permission denied**: Try using `npx` instead of local installation
3. **Server won't start**: Check if port is already in use (for HTTP mode)
4. **No response**: Verify the project path is a valid Next.js project

**Debug Mode:**

```json
{
  "servers": {
    "vibealive": {
      "type": "stdio",
      "command": "npx",
      "args": ["vibealive", "serve", "--stdio"],
      "env": {
        "DEBUG": "vibealive:*"
      }
    }
  }
}
```

See [overview.md](./overview.md) and [cli.md](./cli.md) for more information.
