# VibeAlive for Next.js

VibeAlive is a powerful, framework-aware code analysis tool designed specifically for Next.js applications. It helps you identify unused files, dead code, and redundant API endpoints, keeping your projects clean, performant, and maintainable.

## ✨ Features

- **Framework-Aware Analysis:** Intelligently detects your Next.js version and routing patterns (App Router, Pages Router, or hybrid).
- **Unused Code Detection:** Builds a complete dependency graph to accurately identify orphaned files and components that are no longer referenced.
- **API Endpoint Analysis:** Scans your codebase to find unused API endpoints.
- **Multiple Report Formats:** Generates reports in JSON (for machine consumption), Markdown, and other formats.
- **Local-First MCP Server:** Includes a built-in MCP-compliant server using the official SDK v1.18.1 for programmatic access and integration with LLM agents.

## 🚀 Usage

### Analyzing a Project

The primary command is `analyze`. It scans your project and generates a detailed report in the `./analysis-results` directory.

```bash
npx vibealive analyze <path-to-your-project> [options]
```

**Example:**

```bash
npx vibealive analyze .
```

**Options:**

| Option                  | Description                                             | Default              |
| ----------------------- | ------------------------------------------------------- | -------------------- |
| `--format <formats>`    | Comma-separated list of output formats (json, md, etc.) | `json,md`            |
| `--output <dir>`        | Directory to save reports in.                           | `./analysis-results` |
| `--exclude <patterns>`  | Comma-separated glob patterns to exclude.               | (none)               |
| `--confidence <number>` | Minimum confidence threshold for findings (0-100).      | `80`                 |

---

### Using the MCP Server

For programmatic access or integration with LLM agents, you can start the standardized MCP server. This provides a powerful, machine-readable interface to the analysis engine using the official Model Context Protocol.

```bash
npx vibealive serve [options]
```

**Options:**

| Option                | Description                                                | Default |
| --------------------- | ---------------------------------------------------------- | ------- |
| `-p, --port <number>` | The port to run the HTTP server on                        | `8080`  |
| `--stdio`             | Use stdio transport (for direct MCP client integration)   | false   |
| `--legacy`            | Use legacy API format (deprecated, for compatibility)     | false   |

**Transport Modes:**

1. **HTTP Transport** (default): `npx vibealive serve --port 8080`
   - Best for web-based clients and remote access
   - Endpoint: `http://localhost:8080/mcp`
   - Supports session management and CORS

2. **Stdio Transport**: `npx vibealive serve --stdio`
   - Best for direct MCP client integration
   - Uses stdin/stdout for communication
   - Recommended for CLI tools and local automation

**MCP Tools Available:**
- `analyze-project`: Start a full Next.js project analysis
- `get-job-status`: Check analysis progress
- `get-analysis-report`: Retrieve analysis results (summary or full JSON)
- `get-file-details`: Get detailed analysis for specific files

**MCP Resources:**
- `status://server`: Real-time server status and metrics

For detailed API documentation and client examples, see the [MCP Server Documentation](./MCP_DOCUMENTATION.md).

#### 🚨 Security Note

The MCP server is designed for **local use only** and binds to `localhost` by default. This is a critical security feature to prevent unauthorized access to your code and analysis results.

If you choose to expose this server externally (e.g., using a tool like `ngrok` or by binding to `0.0.0.0`), you are responsible for implementing your own authentication and security measures. **Do not expose the default server to the public internet.**

For full technical details on the MCP API, including all tools, resources, and migration guide from the legacy API, please see the [MCP Server Documentation](./MCP_DOCUMENTATION.md).

## License

MIT
