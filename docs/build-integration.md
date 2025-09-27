# Build Integration & CI/CD

VibeAlive provides comprehensive build-time integration and CI/CD pipeline support to help maintain code quality automatically.

## Quick Start

### Basic Build Integration

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "analyze": "vibealive analyze .",
    "analyze:ci": "vibealive analyze . --ci --fail-on-issues --max-issues 5",
    "prebuild": "npm run analyze:ci"
  }
}
```

### Next.js Webpack Plugin

```javascript
// next.config.js
const { VibeAliveWebpackPlugin } = require('vibealive/webpack');

module.exports = {
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.plugins.push(
        new VibeAliveWebpackPlugin({
          failOnError: process.env.NODE_ENV === 'production',
          maxIssues: 5,
          formats: ['json'],
        })
      );
    }
    return config;
  },
};
```

## CLI Options for CI/CD

### CI Mode Options

- `--ci`: Enable CI-friendly mode with machine-readable output
- `--fail-on-issues`: Exit with non-zero code if issues are found
- `--max-issues <number>`: Maximum issues allowed (default: 0)
- `--silent`: Suppress console output except errors
- `--exit-code-unused <number>`: Custom exit code for unused files (default: 1)
- `--exit-code-dead-code <number>`: Custom exit code for dead code (default: 2)
- `--exit-code-api-unused <number>`: Custom exit code for unused APIs (default: 3)

### Example CI Commands

```bash
# Basic CI check
npx vibealive analyze . --ci --fail-on-issues --max-issues 5

# Strict production check (zero tolerance)
npx vibealive analyze . --ci --fail-on-issues --max-issues 0 --confidence-threshold 95

# Permissive development check
npx vibealive analyze . --max-issues 20 --confidence-threshold 70

# Silent mode for automated builds
npx vibealive analyze . --ci --silent --fail-on-issues --max-issues 10
```

## Configuration File

Create `vibealive.config.js` for build-time settings (see [examples/vibealive.config.js](../examples/vibealive.config.js) for full example):

```javascript
module.exports = {
  analysis: {
    confidenceThreshold: 80,
    maxIssues: 5,
    exclude: ['**/test/**', '**/stories/**'],
  },

  build: {
    failOnError: false,
    showWarnings: true,
    environments: ['production'],
    outputDir: './vibealive-reports',
  },

  ci: {
    enabled: false,
    thresholds: {
      development: { maxIssues: 20, failOnError: false },
      production: { maxIssues: 0, failOnError: true },
    },
  },
};
```

## CI/CD Platform Examples

Complete configuration files are available in the [examples/ci-cd/](../examples/ci-cd/) directory.

### GitHub Actions

```yaml
name: Code Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npx vibealive analyze . --ci --fail-on-issues --max-issues 5
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: vibealive-reports
          path: ./vibealive-reports/
```

### GitLab CI

```yaml
vibealive_analysis:
  image: node:18-alpine
  script:
    - npm ci
    - npx vibealive analyze . --ci --fail-on-issues --max-issues 5
  artifacts:
    reports:
      junit: vibealive-reports/*.json
    paths:
      - vibealive-reports/
```

### Jenkins

```groovy
pipeline {
  agent any
  stages {
    stage('Analysis') {
      steps {
        sh 'npm ci'
        sh 'npx vibealive analyze . --ci --fail-on-issues --max-issues 5'
        archiveArtifacts artifacts: 'vibealive-reports/**/*'
      }
    }
  }
}
```

### CircleCI

```yaml
version: 2.1
jobs:
  analyze:
    docker:
      - image: cimg/node:18.17
    steps:
      - checkout
      - run: npm ci
      - run: npx vibealive analyze . --ci --fail-on-issues --max-issues 5
      - store_artifacts:
          path: vibealive-reports
```

## Advanced Integration Patterns

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "vibealive analyze . --ci --max-issues 10 --silent",
      "pre-push": "vibealive analyze . --ci --fail-on-issues --max-issues 5"
    }
  }
}
```

### Environment-Specific Thresholds

```bash
# Development (permissive)
if [ "$NODE_ENV" = "development" ]; then
  npx vibealive analyze . --max-issues 20 --confidence-threshold 70
fi

# Staging (moderate)
if [ "$NODE_ENV" = "staging" ]; then
  npx vibealive analyze . --ci --fail-on-issues --max-issues 10 --confidence-threshold 80
fi

# Production (strict)
if [ "$NODE_ENV" = "production" ]; then
  npx vibealive analyze . --ci --fail-on-issues --max-issues 0 --confidence-threshold 95
fi
```

### Quality Gates

```yaml
# Multi-stage quality gate
stages:
  - name: 'Quick Analysis'
    command: 'vibealive analyze . --max-issues 50 --confidence-threshold 60'

  - name: 'Standard Analysis'
    command: 'vibealive analyze . --ci --fail-on-issues --max-issues 10'

  - name: 'Strict Analysis'
    command: 'vibealive analyze . --ci --fail-on-issues --max-issues 0 --confidence-threshold 95'
    condition: 'production'
```

## Focused Analysis in CI

### Theme & Styling

```bash
# Run only when style files change
if git diff --name-only HEAD~1 | grep -E '\.(css|scss|less)$|tailwind\.config\.' ; then
  npx vibealive theme-scan .
fi
```

### SEO Analysis

```bash
# Run when metadata files change
if git diff --name-only HEAD~1 | grep -E 'metadata\.|sitemap\.|robots\.' ; then
  npx vibealive seo-scan .
fi
```

### Performance Analysis

```bash
# Run when components or pages change
if git diff --name-only HEAD~1 | grep -E '\.(tsx?|jsx?)$' ; then
  npx vibealive perf-scan .
fi
```

## Report Integration

### Upload to Cloud Storage

```bash
# AWS S3
aws s3 cp ./vibealive-reports s3://my-bucket/reports/$(date +%Y-%m-%d)/ --recursive

# Google Cloud Storage
gsutil -m cp -r ./vibealive-reports gs://my-bucket/reports/$(date +%Y-%m-%d)/
```

### Slack Notifications

```bash
# Send results to Slack
ISSUES=$(cat vibealive-reports/analysis-report-*.json | jq '.summary.unusedFiles + .summary.deadCode + .summary.redundantApis')

if [ "$ISSUES" -gt 5 ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"⚠️ VibeAlive found $ISSUES issues in $CI_PROJECT_NAME\"}" \
    $SLACK_WEBHOOK_URL
fi
```

### Database Storage

```bash
# Store metrics in database
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
UNUSED=$(cat vibealive-reports/analysis-report-*.json | jq '.summary.unusedFiles')
DEAD_CODE=$(cat vibealive-reports/analysis-report-*.json | jq '.summary.deadCode')

curl -X POST "$METRICS_API_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"timestamp\": \"$TIMESTAMP\",
    \"project\": \"$CI_PROJECT_NAME\",
    \"branch\": \"$CI_COMMIT_REF_NAME\",
    \"unused_files\": $UNUSED,
    \"dead_code\": $DEAD_CODE
  }"
```

## Troubleshooting

### Common Issues

1. **Exit code confusion**: Different exit codes indicate different issue types
   - 1: Unused files found
   - 2: Dead code found
   - 3: Unused APIs found

2. **Performance in CI**: Use `--formats json` for faster builds, generate MD reports separately

3. **False positives**: Adjust `--confidence-threshold` and use `--exclude` patterns

4. **Memory issues**: Use `--max-files` to limit analysis scope in large projects

### Debug Mode

```bash
# Enable debug output
DEBUG=vibealive:* npx vibealive analyze . --verbose
```

## Examples Directory

See the [examples/](../examples/) directory for:

- **CI/CD Configurations**: [examples/ci-cd/](../examples/ci-cd/)
  - GitHub Actions workflow
  - GitLab CI configuration
  - Jenkins pipeline
  - CircleCI config
  - Azure DevOps pipeline
  - Docker analysis setup

- **Integration Examples**:
  - [next.config.with-vibealive.js](../examples/next.config.with-vibealive.js) - Next.js webpack plugin setup
  - [vibealive.config.js](../examples/vibealive.config.js) - Complete configuration file
  - [package-scripts.json](../examples/package-scripts.json) - Package.json script examples

- **MCP Integration**:
  - [.vscode-mcp.json](../examples/.vscode-mcp.json) - VS Code MCP configuration
  - [mcp-client.ts](../examples/mcp-client.ts) - Programmatic MCP client

## Further Reading

See [overview.md](./overview.md), [cli.md](./cli.md), and [mcp.md](./mcp.md) for more information.
