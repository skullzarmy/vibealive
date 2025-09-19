# VibeAlive MCP Server Documentation

This document provides the technical specification for the VibeAlive Model-Context-Protocol (MCP) server. The server exposes the core analysis engine, allowing Large Language Models (LLMs) and other tools to programmatically interact with the analyzer.

## 1. Server Endpoint

The server exposes a single endpoint that adheres to the MCP v1.0 specification.

- **URL:** `http://localhost:<port>/`
- **HTTP Method:** `POST`

All interactions are performed by sending a JSON object to this endpoint with a specified `method` and `params`.

For a complete, runnable client example, see the [mcp-client.ts](./examples/mcp-client.ts) file.

## 2. API Methods

### 2.1. `mcp.analyze`

Initiates a full, asynchronous analysis of a Next.js project.

**Request:**

```json
{
  "mcp_version": "1.0",
  "method": "mcp.analyze",
  "params": {
    "projectPath": "/path/to/your/nextjs-project",
    "options": {
      "exclude": ["**/node_modules/**", "**/dist/**"],
      "confidenceThreshold": 80
    }
  }
}
```

**Response (Success):**

Returns a `jobId` that can be used to track the analysis progress.

```json
{
  "mcp_version": "1.0",
  "result": {
    "jobId": "a-unique-job-identifier",
    "status": "queued",
    "message": "Analysis job has been queued."
  }
}
```

### 2.2. `mcp.status`

Checks the status of a previously initiated analysis job.

**Request:**

```json
{
  "mcp_version": "1.0",
  "method": "mcp.status",
  "params": {
    "jobId": "a-unique-job-identifier"
  }
}
```

**Response (Success):**

```json
{
  "mcp_version": "1.0",
  "result": {
    "jobId": "a-unique-job-identifier",
    "status": "processing",
    "progress": 42,
    "message": "Building dependency graph..."
  }
}
```

### 2.3. `mcp.getReport`

Retrieves the full JSON analysis report for a completed job.

**Request:**

```json
{
  "mcp_version": "1.0",
  "method": "mcp.getReport",
  "params": {
    "jobId": "a-unique-job-identifier"
  }
}
```

**Response (Success):**

```json
{
  "mcp_version": "1.0",
  "result": {
    "metadata": { ... },
    "files": [ ... ],
    "apiEndpoints": [ ... ],
    // ... The full analysis report object
  }
}
```

### 2.4. Discovery & Help Methods

#### `mcp.discover`

Returns a machine-readable description of all available server methods.

**Request:**

```json
{
  "mcp_version": "1.0",
  "method": "mcp.discover"
}
```

**Response (Success):**

```json
{
  "mcp_version": "1.0",
  "result": {
    "name": "vibealive",
    "description": "A tool for analyzing Next.js projects to find unused code.",
    "methods": [
      // ... array of method schema objects
    ]
  }
}
```

#### `mcp.status` (Server-Level)

Checks the general health of the MCP server.

**Request:**

```json
{
  "mcp_version": "1.0",
  "method": "mcp.status"
}
```

**Response (Success):**

```json
{
  "mcp_version": "1.0",
  "result": {
    "status": "ok"
  }
}
```

#### `mcp.help`

Provides detailed, human-readable help for a specific method.

**Request:**

```json
{
  "mcp_version": "1.0",
  "method": "mcp.help",
  "params": {
    "method": "mcp.analyze"
  }
}
```

**Response (Success):**

```json
{
  "mcp_version": "1.0",
  "result": "Method: mcp.analyze\nDescription: Initiates a full, asynchronous analysis...\n..."
}
```

## 3. Standardized Error Handling

The server uses a standardized error format to ensure that errors are machine-readable and actionable for an LLM.

**Example Error Response:**

```json
{
  "mcp_version": "1.0",
  "error": {
    "code": -32602,
    "message": "Invalid parameters for method 'mcp.status'.",
    "data": {
      "details": "The 'jobId' parameter is missing or not a valid string.",
      "expectedFormat": {
        "jobId": "string"
      }
    }
  }
}
```
