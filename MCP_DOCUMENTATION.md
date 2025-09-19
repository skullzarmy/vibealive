# VibeAlive MCP Server Documentation

This document provides the technical specification for the VibeAlive Model Context Protocol (MCP) server. The server now uses the official MCP SDK v1.18.1 and follows the standardized MCP protocol for seamless integration with MCP-compatible clients and LLM applications.

## Overview

The VibeAlive MCP server exposes Next.js project analysis capabilities through the standardized Model Context Protocol. This enables LLMs and other tools to programmatically analyze Next.js projects to identify unused code, dead components, and optimization opportunities.

**Key Features:**
- ✅ **Official MCP SDK**: Built with @modelcontextprotocol/sdk v1.18.1
- ✅ **Multiple Transports**: Supports both stdio and HTTP transports
- ✅ **Standardized Protocol**: Full MCP compliance for universal compatibility
- ✅ **Async Job Management**: Long-running analysis with progress tracking
- ✅ **Rich Tool Set**: Comprehensive analysis tools and resources

## Transport Options

### 1. Stdio Transport (Recommended for CLI)

For direct integration with MCP clients and command-line tools:

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

## MCP Tools

The server provides the following standardized MCP tools:

### `analyze-project`

Initiates a full, asynchronous analysis of a Next.js project.

**Parameters:**
- `projectPath` (string, required): Path to the Next.js project
- `options` (object, optional):
  - `exclude` (string[]): Glob patterns to exclude
  - `include` (string[]): Glob patterns to include  
  - `confidenceThreshold` (number): Confidence threshold (0-100)
  - `generateGraph` (boolean): Generate dependency graph
  - `plugins` (string[]): Additional analysis plugins
  - `verbose` (boolean): Enable verbose output

**Returns:**
Job information with ID for tracking progress.

**Example:**
```typescript
await client.callTool({
  name: 'analyze-project',
  arguments: {
    projectPath: '/path/to/nextjs-project',
    options: {
      exclude: ['**/node_modules/**'],
      confidenceThreshold: 80
    }
  }
});
```

### `get-job-status`

Checks the status of an analysis job.

**Parameters:**
- `jobId` (string, required): Job ID returned from analyze-project

**Returns:**
Current job status, progress, and messages.

### `get-analysis-report`

Retrieves the analysis report for a completed job.

**Parameters:**
- `jobId` (string, required): Job ID of completed analysis
- `format` (enum, optional): `"summary"` or `"json"` (default: summary)

**Returns:**
Analysis report in requested format.

### `get-file-details`

Gets detailed analysis for a specific file.

**Parameters:**
- `jobId` (string, required): Job ID of completed analysis
- `filePath` (string, required): Path to the file

**Returns:**
Detailed file analysis including classification, confidence, and usage information.

## MCP Resources

### `server-status`

**URI**: `status://server`

Provides current server status including version, active jobs, and system information.

**Example:**
```typescript
const status = await client.readResource({
  uri: 'status://server'
});
```

## Client Integration

### Using the Official MCP SDK

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
});

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['vibealive', 'serve', '--stdio']
});

await client.connect(transport);

// Use the client...
const tools = await client.listTools();
const result = await client.callTool({
  name: 'analyze-project',
  arguments: { projectPath: '/my/project' }
});
```

### HTTP Client Example

```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport(
  new URL('http://localhost:8080/mcp')
);
await client.connect(transport);
```

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

## Job Lifecycle

1. **Start Analysis**: Call `analyze-project` tool
2. **Get Job ID**: Extract job ID from response
3. **Poll Status**: Use `get-job-status` to monitor progress
4. **Get Results**: Call `get-analysis-report` when completed

## Migration from Legacy API

The legacy HTTP API endpoints are deprecated. Migration guide:

| Legacy Endpoint | New MCP Tool | Notes |
|----------------|--------------|-------|
| `mcp.analyze` | `analyze-project` | Same functionality, standardized parameters |
| `mcp.status` | `get-job-status` | Requires jobId parameter |
| `mcp.getReport` | `get-analysis-report` | Added format parameter |
| `mcp.discover` | `client.listTools()` | Built into MCP protocol |
| `mcp.help` | Tool descriptions | Automatic via MCP schema |

## Configuration

Server configuration through CLI options:

```bash
# Stdio mode (for MCP clients)
npx vibealive serve --stdio

# HTTP mode with custom port
npx vibealive serve --port 3000

# Legacy mode (backwards compatibility)
npx vibealive serve --legacy
```

## Security Considerations

- **Local-First**: Server binds to localhost by default
- **Session Management**: Secure session handling for HTTP transport
- **Input Validation**: All parameters validated using Zod schemas
- **Error Boundary**: Comprehensive error handling and reporting

For production deployments, implement additional security measures including authentication, rate limiting, and network security.

## Examples

See the complete working example at [examples/mcp-client.ts](./examples/mcp-client.ts) for detailed usage patterns and best practices.