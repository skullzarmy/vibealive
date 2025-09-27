# VibeAlive Webpack Plugin

The VibeAlive Webpack Plugin integrates code analysis directly into your build process, allowing you to catch unused code and maintain quality automatically.

## Installation

The plugin is included with VibeAlive and can be imported from the main package:

```javascript
const { VibeAliveWebpackPlugin } = require('vibealive/webpack');
```

## Basic Usage

### Next.js Integration

```javascript
// next.config.js
const { VibeAliveWebpackPlugin } = require('vibealive/webpack');

module.exports = {
  webpack: (config, { dev, isServer }) => {
    // Only run in production builds, client-side
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

### Standard Webpack Configuration

```javascript
// webpack.config.js
const { VibeAliveWebpackPlugin } = require('vibealive/webpack');

module.exports = {
  // ... other webpack config
  plugins: [
    new VibeAliveWebpackPlugin({
      projectPath: __dirname,
      confidenceThreshold: 80,
      failOnError: true,
      showWarnings: true,
      outputDir: './build-reports',
      formats: ['json', 'md'],
      environments: ['production'],
    }),
  ],
};
```

## Configuration Options

### Core Options

| Option                | Type       | Default                                               | Description                                   |
| --------------------- | ---------- | ----------------------------------------------------- | --------------------------------------------- |
| `projectPath`         | `string`   | `process.cwd()`                                       | Path to analyze (defaults to webpack context) |
| `confidenceThreshold` | `number`   | `80`                                                  | Minimum confidence for findings (0-100)       |
| `exclude`             | `string[]` | `['**/node_modules/**', '**/.git/**', '**/.next/**']` | Patterns to exclude from analysis             |

### Build Behavior

| Option         | Type       | Default          | Description                                     |
| -------------- | ---------- | ---------------- | ----------------------------------------------- |
| `failOnError`  | `boolean`  | `false`          | Whether to fail the build when issues are found |
| `showWarnings` | `boolean`  | `true`           | Show analysis results as webpack warnings       |
| `environments` | `string[]` | `['production']` | Only run in specific NODE_ENV values            |

### Output Options

| Option      | Type             | Default                 | Description                    |
| ----------- | ---------------- | ----------------------- | ------------------------------ |
| `outputDir` | `string`         | `'./vibealive-reports'` | Directory for analysis reports |
| `formats`   | `OutputFormat[]` | `['json']`              | Report formats to generate     |

## Environment-Specific Configuration

```javascript
const { VibeAliveWebpackPlugin } = require('vibealive/webpack');

const getAnalysisConfig = (env) => {
  const configs = {
    development: {
      failOnError: false,
      maxIssues: 50,
      confidenceThreshold: 60,
      showWarnings: false,
    },
    staging: {
      failOnError: true,
      maxIssues: 10,
      confidenceThreshold: 80,
      showWarnings: true,
    },
    production: {
      failOnError: true,
      maxIssues: 0,
      confidenceThreshold: 95,
      showWarnings: true,
    },
  };

  return configs[env] || configs.production;
};

module.exports = {
  plugins: [
    new VibeAliveWebpackPlugin({
      ...getAnalysisConfig(process.env.NODE_ENV),
      formats: ['json'], // Keep reports lightweight in builds
    }),
  ],
};
```

## Integration with Configuration File

The plugin will automatically load settings from `vibealive.config.js` and merge them with plugin options:

```javascript
// vibealive.config.js
module.exports = {
  webpack: {
    enabled: true,
    options: {
      confidenceThreshold: 85,
      exclude: ['**/test/**', '**/stories/**'],
    },
  },
};

// webpack.config.js - plugin options override config file
new VibeAliveWebpackPlugin({
  failOnError: process.env.CI === 'true', // Override for CI builds
});
```

## Output Integration

### Build Warnings

When `showWarnings: true`, analysis results appear in webpack output:

```
WARNING in VibeAlive found 3 potential issues:
  - 2 unused files
  - 1 dead components
  - 0 unused API routes
  Reports saved to: ./vibealive-reports
```

### Build Failures

When `failOnError: true` and issues exceed thresholds:

```
ERROR in VibeAlive found 8 potential issues:
  - 5 unused files
  - 2 dead components
  - 1 unused API routes
  Reports saved to: ./vibealive-reports
```

## Performance Considerations

### Optimization Tips

1. **Use JSON format only**: Markdown generation is slower
2. **Limit to production**: Skip analysis in development builds
3. **Exclude test files**: Add test patterns to exclude list
4. **Cache reports**: Store reports outside build directory

### Build Time Impact

```javascript
// Minimal impact configuration
new VibeAliveWebpackPlugin({
  formats: ['json'], // Fastest format
  showWarnings: false, // Reduce console output
  environments: ['production'], // Skip dev builds
  exclude: [
    '**/node_modules/**',
    '**/__tests__/**',
    '**/test/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/stories/**',
  ],
});
```

## Advanced Usage

### Conditional Plugin Loading

```javascript
const plugins = [
  // ... other plugins
];

// Only add VibeAlive in specific conditions
if (process.env.ANALYZE_BUILD === 'true') {
  plugins.push(
    new VibeAliveWebpackPlugin({
      failOnError: false,
      formats: ['json', 'md'],
      outputDir: './detailed-analysis',
    })
  );
}

module.exports = {
  plugins,
};
```

### Multiple Analysis Passes

```javascript
// Different analysis for different purposes
const plugins = [
  // Quick analysis for all builds
  new VibeAliveWebpackPlugin({
    confidenceThreshold: 90,
    formats: ['json'],
    showWarnings: false,
  }),
];

// Detailed analysis for release builds
if (process.env.RELEASE_BUILD === 'true') {
  plugins.push(
    new VibeAliveWebpackPlugin({
      confidenceThreshold: 70,
      formats: ['json', 'md'],
      outputDir: './release-analysis',
      failOnError: true,
    })
  );
}
```

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Build with Analysis
  run: npm run build
  env:
    NODE_ENV: production
    ANALYZE_BUILD: true

- name: Upload Analysis Reports
  uses: actions/upload-artifact@v4
  with:
    name: analysis-reports
    path: ./vibealive-reports/
```

### GitLab CI

```yaml
build:
  script:
    - npm run build
  artifacts:
    paths:
      - vibealive-reports/
    when: always
  variables:
    NODE_ENV: production
```

## Troubleshooting

### Common Issues

1. **Plugin not running**: Check `environments` setting matches `NODE_ENV`
2. **No reports generated**: Ensure `outputDir` is writable
3. **Build failures**: Adjust `confidenceThreshold` or `maxIssues`
4. **Performance issues**: Use JSON format only, exclude test files

### Debug Mode

```javascript
new VibeAliveWebpackPlugin({
  verbose: true, // Enable detailed logging
  showWarnings: true, // See all analysis output
});
```

### Error Handling

The plugin gracefully handles errors to avoid breaking builds:

```javascript
new VibeAliveWebpackPlugin({
  failOnError: false, // Analysis errors become warnings
});
```

## See Also

- [Build Integration Guide](./build-integration.md)
- [Configuration Reference](../examples/vibealive.config.js)
- [Next.js Example](../examples/next.config.with-vibealive.js)
- [CLI Documentation](./cli.md)
