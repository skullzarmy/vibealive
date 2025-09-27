# VibeAlive Overview

VibeAlive is a powerful, framework-aware code analysis tool designed specifically for Next.js applications. It helps you identify unused files, dead code, and redundant API endpoints, keeping your projects clean, performant, and maintainable.

## Key Features

- **Framework-Aware Analysis:** Intelligently detects your Next.js version and routing patterns (App Router, Pages Router, or hybrid)
- **Unused Code Detection:** Builds a complete dependency graph to accurately identify orphaned files and components that are no longer referenced
- **API Endpoint Analysis:** Scans your codebase to find unused API endpoints
- **Multiple Report Formats:** Generates reports in JSON (for machine consumption), Markdown, and other formats
- **Local-First MCP Server:** Includes a built-in MCP-compliant server using the official SDK v1.18.1 for programmatic access and integration with LLM agents
- **Advanced Pattern Detection:** Identifies Next.js routing patterns including route groups, private folders, intercepting routes, parallel routes, and dynamic segments
- **Package Analysis:** Detects common Next.js packages and provides setup recommendations for themes, SEO, performance, and accessibility
- **Project Health Scoring:** Comprehensive analysis with actionable recommendations for improvement

## Usage

- Analyze your project: `npx vibealive analyze <path>`
- Start MCP server: `npx vibealive serve [options]`
- Reports saved in `./analysis-results`

## Report Output

Analysis reports include:

- **Unused Files:** Files not referenced anywhere in your codebase
- **Dead Components:** React components that are no longer used
- **Unused API Routes:** API endpoints with no incoming requests detected
- **Dependency Graph:** Visual representation of file dependencies
- **Framework Patterns:** Advanced Next.js routing and architectural patterns in use
- **Setup Analysis:** Missing or incomplete configurations for common packages
- **Performance Recommendations:** Optimization opportunities and best practices

See [cli.md](./cli.md) and [mcp.md](./mcp.md) for detailed usage instructions.
