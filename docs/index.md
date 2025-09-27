# VibeAlive Documentation

Welcome to the VibeAlive documentation. VibeAlive is a framework-aware code analysis tool for Next.js projects.

## Getting Started

- [Overview](./overview.md) - Features, capabilities, and what VibeAlive can do
- [CLI Usage](./cli.md) - Command-line interface and analysis commands
- [MCP Server & Integration](./mcp.md) - IDE integration and programmatic access
- [Build Integration & CI/CD](./build-integration.md) - Automated analysis in build pipelines
- [Webpack Plugin](./webpack-plugin.md) - Build-time analysis integration

## Quick Links

- **Analyze a project**: `npx vibealive analyze <path>`
- **Start MCP server**: `npx vibealive serve --stdio`
- **IDE setup**: Create `.vscode/mcp.json` with stdio configuration
- **Focused analysis**: Use commands like `theme-scan`, `seo-scan`, `perf-scan`

## What's New

- **Build Integration**: Webpack plugin and comprehensive CI/CD pipeline support
- **Advanced Pattern Detection**: Route groups, parallel routes, intercepting routes
- **Focused Analysis Commands**: `theme-scan`, `seo-scan`, `perf-scan`, `a11y-scan`
- **Project Health Scoring**: Actionable recommendations with confidence ratings
- **Enhanced MCP Integration**: 15+ specialized tools for granular analysis
- **CI-Friendly CLI**: Machine-readable output, exit codes, environment-specific thresholds

## Examples & Configurations

See the [examples/](../examples/) directory for ready-to-use configurations:

- **CI/CD Pipelines**: GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure DevOps
- **Build Integration**: Webpack plugin setup and Next.js configurations
- **MCP Setup**: VS Code integration and programmatic clients
- **Package Scripts**: npm/yarn scripts for different analysis scenarios
