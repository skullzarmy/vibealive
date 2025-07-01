# 🚨 PRIME DIRECTIVE

**WORK SLOWLY AND COLLABORATIVELY WITH THE USER - RECEIVE FULL APPROVAL PRIOR TO ANY CODE CHANGES**

# MCP Server - Architecture & Plan

## 1. Objective

To extend the `vibealive` tool with a **Model-View-Controller (MCP) server**. This server will expose the core analysis engine to Large Language Models (LLMs), enabling them to programmatically trigger scans, receive structured analysis data, and potentially perform advanced operations based on the results.

## 2. Architectural Discussion & Options

_(This section is a placeholder for our collaborative discussion. We will use this space to define the server's API, data models, and overall architecture.)_

### Key Questions to Address:

- **API Design:** What specific endpoints should the server expose? (e.g., `/analyze`, `/report/{id}`, `/status/{id}`)
- **Data Models:** What JSON structures should the API use for requests and responses?
- **Authentication:** How will the server handle security and authentication?
- **State Management:** How will the server manage the state of long-running analysis jobs?
- **Extensibility:** How can we design the server to support future LLM-driven actions?

## 2. API Design & Data Models

The server will adhere to the Model-Context-Protocol (MCP) v1.0 specification. It will expose a single `POST /` endpoint that accepts standardized JSON request objects.

### 2.1. Core Methods

#### `mcp.analyze`

- **Purpose:** Initiates a full analysis of a Next.js project. This is an asynchronous operation.
- **Request:**
  ```json
  {
    "mcp_version": "1.0",
    "method": "mcp.analyze",
    "params": {
      "projectPath": "/path/to/user/project",
      "options": {
        "exclude": ["**/node_modules/**"],
        "confidenceThreshold": 80
      }
    }
  }
  ```
- **Response:**
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

#### `mcp.status`

- **Purpose:** Checks the status of a previously initiated analysis job.
- **Request:**
  ```json
  {
    "mcp_version": "1.0",
    "method": "mcp.status",
    "params": { "jobId": "a-unique-job-identifier" }
  }
  ```
- **Response:**
  ```json
  {
    "mcp_version": "1.0",
    "result": {
      "jobId": "a-unique-job-identifier",
      "status": "processing" | "completed" | "failed",
      "progress": 42,
      "message": "Building dependency graph..."
    }
  }
  ```

#### `mcp.getReport`

- **Purpose:** Retrieves the full JSON analysis report for a completed job.
- **Request:**
  ```json
  {
    "mcp_version": "1.0",
    "method": "mcp.getReport",
    "params": { "jobId": "a-unique-job-identifier" }
  }
  ```
- **Response:**
  ```json
  {
    "mcp_version": "1.0",
    "result": {
      // The complete analysis-report.json object
    }
  }
  ```

### 2.2. Granular Analysis Methods

#### `mcp.getFileDetails`

- **Purpose:** Retrieves the detailed `FileAnalysis` object for a single file, on-demand.
- **Request:**
  ```json
  {
    "mcp_version": "1.0",
    "method": "mcp.getFileDetails",
    "params": {
      "projectPath": "/path/to/user/project",
      "filePath": "src/components/some-component.tsx"
    }
  }
  ```
- **Response:**
  ```json
  {
    "mcp_version": "1.0",
    "result": {
      /* FileAnalysis object */
    }
  }
  ```

#### `mcp.getDependencyInfo`

- **Purpose:** Retrieves the import/export relationships for a specific file.
- **Request:**
  ```json
  {
    "mcp_version": "1.0",
    "method": "mcp.getDependencyInfo",
    "params": {
      "projectPath": "/path/to/user/project",
      "filePath": "src/utils/some-util.ts"
    }
  }
  ```
- **Response:**
  ```json
  {
    "mcp_version": "1.0",
    "result": {
      "filePath": "src/utils/some-util.ts",
      "imports": [
        /* ... */
      ],
      "importedBy": [
        /* ... */
      ]
    }
  }
  ```

### 2.3. Standardized Error Handling

All error responses will conform to the MCP standard to ensure they are machine-readable and actionable for an LLM.

- **Response Body:**
  ```json
  {
    "mcp_version": "1.0",
    "error": {
      "code": -32602,
      "message": "Invalid parameters for method 'mcp.getFileDetails'.",
      "data": {
        "details": "The 'filePath' parameter is missing or not a valid string.",
        "expectedFormat": {
          "filePath": "string (e.g., 'src/components/some-component.tsx')"
        }
      }
    }
  }
  ```

## 3. Key Architectural Decisions

Based on the project's scope as a local development tool, the following architectural decisions have been made to ensure a secure-by-default and user-friendly experience.

### 3.1. Authentication

- **Localhost by Default:** The server will **only** bind to `localhost` by default. This is an essential security measure that prevents external access unless the user explicitly decides to expose it.
- **No Built-in Authentication:** For this initial version, we will **not** implement API keys, tokens, or any other complex authentication schemes. The focus is on providing a seamless local experience.

### 3.2. State Management

- **In-Memory Job Tracking:** The server will use a simple, in-memory JavaScript object (a `Map` or plain object) to track the state of analysis jobs. The `jobId` will serve as the key.
- **No Persistence:** Job history will not be persisted across server restarts. This is a suitable trade-off for a local development tool and keeps the architecture simple and dependency-free.

### 3.3. Documentation & User Guidance

- **Comprehensive `README.md`:** The implementation will include the creation of a new, detailed `README.md` from scratch.
- **Clear Instructions:** This documentation will provide clear, explicit instructions on:
  - How to run the MCP server locally.
  - The purpose of binding to `localhost` for security.
  - Guidance and warnings for advanced users who may wish to expose the server externally (e.g., using tools like `ngrok` or by binding to `0.0.0.0`), making it clear that they are responsible for securing their own endpoint.

## 4. Technology Choices

- **Web Server Framework:** **Express.js**. While other modern frameworks like Fastify or Hono exist, Express is the most downloaded, battle-tested, and widely understood framework in the Node.js ecosystem. For a local development tool intended for broad distribution, choosing this proven, dependency-light wheel is the most robust and user-friendly option. It guarantees maximum compatibility with no external runtime requirements for the end-user.
- **Job ID Generation:** We will use the built-in `crypto` module to generate secure, random IDs for analysis jobs, ensuring they are unique without adding external dependencies.

## 5. Implementation Steps

1.  **~~Setup Server Foundation & First Endpoint:~~** ✅ **DONE**
    - ~~Install `express` and `@types/express`.~~ ✅ **DONE**
    - ~~Create `src/mcp/server.ts` with a basic Express server.~~ ✅ **DONE**
    - ~~Implement the `POST /` endpoint with a placeholder for method routing.~~ ✅ **DONE**
    - ~~Add a `serve` command to `src/cli.ts`.~~ ✅ **DONE**
    - ~~**Implement initial, robust error handling middleware**~~ ✅ **DONE**

2.  **~~Implement Job Management & `mcp.status`:~~** ✅ **DONE**
    - ~~Create `src/mcp/job-manager.ts` for in-memory job state tracking.~~ ✅ **DONE**
    - ~~Implement the `mcp.status` method logic within the `POST /` endpoint.~~ ✅ **DONE**
    - ~~**Add specific error handling** for the `mcp.status` method (e.g., `jobId not found`).~~ ✅ **DONE**

3.  **~~Implement `mcp.analyze` & Asynchronous Jobs:~~** ✅ **DONE**
    - ~~Implement the `mcp.analyze` method to create a job and run the `NextJSAnalyzer` asynchronously.~~ ✅ **DONE**
    - ~~Ensure the `JobManager` correctly tracks the "processing," "completed," and "failed" states.~~ ✅ **DONE**
    - ~~**Add specific error handling** for analysis failures.~~ ✅ **DONE**

4.  **~~Implement Report & Data Retrieval (`mcp.getReport`, etc.):~~** ✅ **DONE**
    - ~~Implement the `mcp.getReport`, `mcp.getFileDetails`, and `mcp.getDependencyInfo` methods.~~ ✅ **DONE**
    - ~~**Add specific error handling** for each data retrieval method.~~ ✅ **DONE**

5.  **~~Create Comprehensive `README.md`:~~** ✅ **DONE**
    - ~~Write a new `README.md` from scratch, documenting all features and the robust error handling that is now built-in.~~ ✅ **DONE**

6.  **~~Define Formal API Schema:~~** ✅ **DONE**
    - ~~Create a new file, `src/mcp/schema.ts`, that exports a static, machine-readable schema object.~~ ✅ **DONE**
    - ~~This schema will be the **single source of truth** for the server's capabilities, defining every method, its parameters (including names, types, and required status), and its return values.~~ ✅ **DONE**

7.  **~~Implement Full MCP Discovery:~~** ✅ **DONE**
    - ~~Implement the `mcp.discover` method. This method will **programmatically generate its response directly from the formal schema** created in Step 6.~~ ✅ **DONE**
    - ~~Implement the server-level `mcp.status` method to return `{"status": "ok"}`.~~ ✅ **DONE**
    - ~~Implement the `mcp.help` method, which will also use the formal schema to provide detailed, human-readable help text for any requested method.~~ ✅ **DONE**

8.  **~~Create Comprehensive Usage Examples:~~** ✅ **DONE**
    - ~~Create a new `examples/` directory.~~ ✅ **DONE**
    - ~~Add a `programmatic-usage.ts` file demonstrating how to use the `NextJSAnalyzer` class directly.~~ ✅ **DONE**
    - ~~Add a `mcp-client.ts` file demonstrating how to interact with the MCP server's API for all methods (`analyze`, `status`, `discover`, etc.).~~ ✅ **DONE**
    - ~~Update the `README.md` and `MCP_DOCUMENTATION.md` to reference these new, relevant examples.~~ ✅ **DONE**
