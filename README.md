# VibeAlive

A framework-aware code analysis tool for Next.js projects. Identify unused files, dead code, and redundant API endpoints to keep your codebase clean and maintainable.

## Quick Start

```bash
# Analyze your Next.js project
npx vibealive analyze .

# Start MCP server for IDE integration
npx vibealive serve --stdio
```

## Features

- **Smart Analysis**: Detects Next.js versions and routing patterns (App Router, Pages Router, hybrid)
- **Dependency Tracking**: Builds complete dependency graph to find orphaned files
- **API Analysis**: Identifies unused API endpoints
- **Multiple Formats**: Generates JSON, Markdown, and other report formats
- **MCP Integration**: Built-in Model Context Protocol server for IDE/LLM integration
- **Build Integration**: Webpack plugin and CI/CD pipeline support
- **Focused Scans**: Specialized analysis for themes, SEO, performance, and accessibility

## Installation

```bash
# Run directly with npx (recommended)
npx vibealive analyze <project-path>

# Or install globally
npm install -g vibealive
```

## Documentation

See the [docs](./docs/) directory for complete documentation:

- [Overview](./docs/overview.md) - Features and capabilities
- [CLI Usage](./docs/cli.md) - Command-line interface
- [MCP Server](./docs/mcp.md) - Integration with IDEs and tools
- [Build Integration](./docs/build-integration.md) - Automated analysis in CI/CD pipelines

## License

MIT
