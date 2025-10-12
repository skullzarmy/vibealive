# ![johnny vibealive](media/johnny-vibealive-sm.png)

A framework-aware code analysis tool for Next.js projects. Identify unused files, dead code, and redundant API endpoints to keep your codebase clean and maintainable.

## Quick Start

```bash
# Analyze your Next.js project
npx vibealive analyze .

# Use in different languages
npx vibealive analyze . --locale es  # Spanish
npx vibealive analyze . --locale fr  # French
npx vibealive analyze . --locale de  # German
npx vibealive analyze . --locale pt  # Portuguese

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
- **Focused Scans**: Specialized analysis for themes, SEO, performance, and comprehensive WCAG 2.2 accessibility compliance
- **Internationalization**: Multi-language support with community translations

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
- [Internationalization](./docs/i18n.md) - Multi-language support and translation guide

## Contributing

We welcome contributions from the community! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Development setup and workflow
- Code style and testing requirements
- Pull request process and review guidelines
- Types of contributions we're looking for

Please also review our [Code of Conduct](./CODE_OF_CONDUCT.md) which outlines our community standards and expectations for respectful collaboration.

## License

MIT
