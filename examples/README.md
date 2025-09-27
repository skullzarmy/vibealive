# Examples Directory

This directory contains practical examples and configurations for integrating VibeAlive into your development workflow.

## CI/CD Pipeline Examples (`ci-cd/`)

Complete configuration files for popular CI/CD platforms:

### [GitHub Actions](./ci-cd/github-actions.yml)
- Full workflow with artifact upload and PR comments
- Pages deployment for analysis reports
- Strict production checks with zero tolerance mode
- Matrix builds for different environments

### [GitLab CI](./ci-cd/gitlab-ci.yml)
- Multi-stage pipeline with focused scans
- Artifact caching and report generation
- Conditional execution based on file changes
- Pages deployment integration

### [Jenkins](./ci-cd/Jenkinsfile)
- Parameterized pipeline with analysis modes
- Parallel execution for different scan types
- Slack notifications and report archiving
- Build description with issue summaries

### [CircleCI](./ci-cd/circleci-config.yml)
- Orb-based configuration with workflows
- Scheduled analysis and focused scans
- Test result storage and artifact management
- Environment-specific configurations

### [Azure DevOps](./ci-cd/azure-pipelines.yml)
- Multi-stage pipeline with quality gates
- Task-based configuration with caching
- Artifact publishing and test integration
- Production deployment checks

### [Docker Analysis](./ci-cd/Dockerfile.analysis)
- Multi-stage Docker setup for analysis
- Environment-based configuration
- Production and development analysis modes
- Containerized CI/CD integration

## Integration Examples

### [Next.js Configuration](./next.config.with-vibealive.js)
Complete Next.js configuration with VibeAlive webpack plugin:

```javascript
const { VibeAliveWebpackPlugin } = require('vibealive/webpack');

module.exports = {
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.plugins.push(
        new VibeAliveWebpackPlugin({
          failOnError: process.env.NODE_ENV === 'production',
          maxIssues: 5,
          formats: ['json']
        })
      );
    }
    return config;
  }
};
```

### [Configuration File](./vibealive.config.js)
Comprehensive VibeAlive configuration with all available options:

- Analysis settings (thresholds, exclusions)
- Build integration options
- CI/CD specific settings with environment thresholds
- Focused scan configurations (theme, SEO, performance, a11y)
- Webpack plugin settings
- Next.js specific configurations
- Report generation settings

### [Package Scripts](./package-scripts.json)
Ready-to-use npm scripts for various analysis scenarios:

```json
{
  "scripts": {
    "analyze": "vibealive analyze .",
    "analyze:ci": "vibealive analyze . --ci --fail-on-issues --max-issues 5",
    "analyze:strict": "vibealive analyze . --ci --fail-on-issues --max-issues 0 --confidence-threshold 95",
    "scan:theme": "vibealive theme-scan .",
    "scan:seo": "vibealive seo-scan .",
    "scan:perf": "vibealive perf-scan .",
    "scan:a11y": "vibealive a11y-scan .",
    "health": "vibealive health ."
  }
}
```

## MCP Integration Examples

### [VS Code Configuration](./.vscode-mcp.json)
Standard VS Code MCP server configuration:

```json
{
  "servers": {
    "vibealive": {
      "type": "stdio",
      "command": "npx",
      "args": ["vibealive", "serve", "--stdio"]
    }
  }
}
```

### [Alternative Configurations]
- [HTTP MCP Configuration](./.vscode-mcp-http.json) - For remote access
- [Package Manager Variations](./.vscode-mcp-package-managers.json) - Using yarn, pnpm, bun

### [Programmatic MCP Client](./mcp-client.ts)
TypeScript example showing how to integrate with the MCP server programmatically:

- SDK-based client setup
- Job management (start, monitor, retrieve results)
- Error handling and type safety
- Multiple analysis types

### [Programmatic Usage](./programmatic-usage.ts)
Direct analyzer usage without MCP layer:

- Configuration setup
- Running analysis programmatically
- Processing results
- Integration into custom tools

## Usage Patterns

### Development Workflow
1. **Pre-commit Analysis**: Light analysis to catch obvious issues
2. **PR Analysis**: Medium strictness with detailed reporting
3. **Production Analysis**: Strict mode with zero tolerance

### Environment-Specific Thresholds
- **Development**: `maxIssues: 20, confidence: 70%`
- **Staging**: `maxIssues: 10, confidence: 80%`
- **Production**: `maxIssues: 0, confidence: 95%`

### Focused Analysis Triggers
- **Theme Analysis**: When CSS/styling files change
- **SEO Analysis**: When metadata/routing files change
- **Performance Analysis**: When component/page files change
- **Accessibility Analysis**: When UI components change

## Best Practices

### CI/CD Integration
- Use `--ci` flag for machine-readable output
- Set appropriate `--max-issues` thresholds per environment
- Cache `node_modules` and analysis results when possible
- Upload reports as artifacts for debugging
- Use focused scans to reduce analysis time

### Configuration Management
- Use `vibealive.config.js` for team-wide settings
- Override with environment variables in CI
- Separate configurations for different project types
- Document threshold decisions and rationale

### Report Management
- Generate multiple formats (JSON for machines, MD for humans)
- Store historical reports for trend analysis
- Integrate with notification systems (Slack, email)
- Archive reports with build artifacts

## Getting Started

1. **Choose your platform**: Pick a CI/CD example that matches your setup
2. **Copy configuration**: Start with the provided configuration file
3. **Adjust thresholds**: Modify `maxIssues` and `confidenceThreshold` for your needs
4. **Test locally**: Run analysis locally before deploying to CI
5. **Monitor and iterate**: Adjust settings based on team feedback and results

## Support

For questions about specific integrations or configurations, see:
- [Build Integration Documentation](../docs/build-integration.md)
- [CLI Documentation](../docs/cli.md)
- [MCP Documentation](../docs/mcp.md)