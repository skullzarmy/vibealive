# Bundle Analysis Integration

VibeAlive now includes real bundle size impact analysis that calculates the actual bytes you can save by removing unused code from your Next.js project.

## Features

### 🎯 Real Bundle Size Analysis

- **Webpack Stats Integration**: Parses actual webpack compilation stats
- **Unused Code Impact**: Calculates exact bytes of unused modules
- **Bundle Size Reduction**: Shows potential savings in raw and gzipped sizes
- **Module-Level Breakdown**: Identifies specific files contributing to bundle bloat

### 📊 Accurate Measurements

- **Total Bundle Size**: Complete application bundle analysis
- **Unused Code Size**: Precise measurement of removable code
- **Gzipped Impact**: Real compression savings calculation
- **Percentage Savings**: Bundle reduction as percentage of total size

### 💡 Smart Recommendations

- **Remove Unused Modules**: Prioritized by size impact
- **Code Splitting Opportunities**: Large modules that could benefit from splitting
- **Import Optimizations**: Suggestions for more efficient imports

## Usage

### CLI Command

```bash
# Analyze bundle impact with webpack stats
npx vibealive bundle-scan .

# Specify build output path
npx vibealive bundle-scan . --build-path ./dist

# Generate detailed reports
npx vibealive bundle-scan . --format json,md --output ./bundle-reports
```

### Integration with Regular Analysis

Bundle analysis is automatically included in standard analysis:

```bash
# Regular analysis now includes bundle impact
npx vibealive analyze .
```

### Programmatic Usage

```typescript
import { NextJSAnalyzer, BundleAnalyzer } from 'vibealive';

const analyzer = new NextJSAnalyzer(config);
const report = await analyzer.analyze();

if (report.bundleAnalysis) {
  console.log('Bundle savings:', report.bundleAnalysis.potentialSavings);
}
```

## How It Works

### 1. Webpack Stats Detection

VibeAlive automatically looks for webpack stats in common locations:

- `stats.json` (project root)
- `.next/build-stats.json` (Next.js builds)
- `dist/stats.json` (custom builds)

### 2. Stats Generation

If no stats are found, VibeAlive can generate them:

**Next.js Projects:**

```bash
# Temporary next.config.js modification to export stats
ANALYZE_BUNDLE=true npm run build
```

**Generic Webpack Projects:**

```bash
# Standard webpack stats generation
npx webpack --profile --json > stats.json
```

### 3. Module Analysis

- Maps unused files to webpack modules
- Calculates actual compiled sizes
- Estimates gzip compression impact
- Identifies dependency relationships

### 4. Impact Calculation

- **Raw Size**: Uncompressed bundle reduction
- **Gzipped Size**: Compressed transfer savings
- **Percentage**: Relative improvement to total bundle

## Configuration

### Next.js Integration

Add to your `next.config.js` for automatic stats generation:

```javascript
const { VibeAliveWebpackPlugin } = require('vibealive/webpack');

module.exports = {
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer && process.env.ANALYZE_BUNDLE) {
      config.plugins.push(
        new VibeAliveWebpackPlugin({
          formats: ['json'],
          outputDir: './vibealive-reports',
        })
      );

      // Generate stats for bundle analysis
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.done.tap('StatsPlugin', (stats) => {
            require('fs').writeFileSync(
              'stats.json',
              JSON.stringify(stats.toJson({ all: true }), null, 2)
            );
          });
        },
      });
    }
    return config;
  },
};
```

### Build Script Integration

Update your `package.json` scripts:

```json
{
  "scripts": {
    "build": "next build",
    "build:analyze": "ANALYZE_BUNDLE=true npm run build && npx vibealive bundle-scan .",
    "analyze:bundle": "npx vibealive bundle-scan ."
  }
}
```

### CI/CD Integration

```yaml
# GitHub Actions
- name: Build and Analyze Bundle
  run: |
    npm run build
    npx vibealive bundle-scan . --format json

- name: Upload Bundle Analysis
  uses: actions/upload-artifact@v4
  with:
    name: bundle-analysis
    path: vibealive-reports/
```

## Report Output

### Console Summary

```
📦 Bundle Analysis Summary:
• Total bundle size: 2.1 MB
• Unused code size: 340 KB
• Potential savings: 340 KB (16.2%)
• Gzipped savings: 102 KB

💡 Top Bundle Recommendations:
1. Remove unused component "LargeChart" (Save 89 KB)
2. Remove unused utility "unused-lodash-functions" (Save 67 KB)
3. Code split large module "dashboard-components" (Save 120 KB)
```

### Markdown Report

The bundle analysis section is automatically included in markdown reports:

```markdown
## 📦 Bundle Size Analysis

### Current Bundle Impact

- **Total Bundle Size**: 2.1 MB
- **Gzipped Size**: 630 KB
- **Unused Code Size**: 340 KB (16.2% of total)

### Potential Savings

- **Raw Size Reduction**: 340 KB
- **Gzipped Reduction**: 102 KB
- **Bundle Size Improvement**: 16.2%

### Top Unused Modules by Size

- `components/unused/LargeChart.tsx` - 89 KB (27 KB gzipped)
- `utils/unused-helpers.ts` - 67 KB (20 KB gzipped)
- `lib/old-analytics.js` - 45 KB (14 KB gzipped)
```

### JSON Output

```json
{
  "bundleAnalysis": {
    "totalBundleSize": 2198732,
    "gzippedSize": 659619,
    "unusedCodeSize": 356234,
    "potentialSavings": {
      "bytes": 356234,
      "gzipped": 106870,
      "percentage": 16.2
    },
    "moduleBreakdown": [...],
    "recommendations": [...]
  }
}
```

## Performance Impact

### Build Time

- **Minimal Impact**: Analysis runs post-build using existing stats
- **Optional**: Can be disabled for faster builds
- **Parallel**: Doesn't interfere with webpack compilation

### Accuracy

- **Webpack Stats**: Uses actual compilation data, not estimates
- **Module Resolution**: Follows webpack's exact module resolution
- **Tree Shaking Aware**: Accounts for webpack's dead code elimination

## Troubleshooting

### No Bundle Analysis Available

```
⚠️ Bundle analysis not available - webpack stats not found
💡 Run `npm run build` first to generate webpack stats
```

**Solutions:**

1. Run `npm run build` to generate stats
2. Add stats generation to your webpack config
3. Manually generate stats: `npx webpack --profile --json > stats.json`

### Inaccurate Size Calculations

- Ensure stats include all necessary modules
- Check that webpack is outputting complete stats
- Verify that unused files are actually unreferenced

### Large Stats Files

- Stats files can be large (1-10MB) for big projects
- Add `stats.json` to `.gitignore`
- Use `--formats json` for faster processing

## Best Practices

### Development Workflow

1. **Regular Analysis**: Run bundle analysis weekly
2. **Pre-deployment**: Always analyze before major releases
3. **Monitoring**: Track bundle size trends over time
4. **Team Awareness**: Share bundle impact in code reviews

### Optimization Strategy

1. **Start with Largest**: Remove biggest unused modules first
2. **Code Splitting**: Split large modules even if used
3. **Import Optimization**: Use tree-shakable imports
4. **Regular Cleanup**: Schedule periodic unused code removal

### Integration Patterns

```bash
# Development: Quick check
npm run analyze:bundle

# CI/CD: Full analysis with reports
npm run build && npx vibealive bundle-scan . --format json,md

# Pre-commit: Bundle size validation
npx vibealive analyze . --ci --max-bundle-bloat 5%
```

## Examples

See [examples/bundle-analysis/](../examples/bundle-analysis/) for:

- Next.js webpack configuration
- CI/CD pipeline integration
- Build script automation
- Bundle size monitoring setup

This bundle analysis feature provides real, actionable data about the impact of unused code on your application's performance, helping you make informed decisions about code cleanup and optimization.
