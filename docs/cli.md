# VibeAlive CLI Documentation

The VibeAlive CLI provides commands for analyzing Next.js projects and managing reports.

## Commands

### `analyze`

Scan your project and generate a comprehensive report.

```bash
npx vibealive analyze <path-to-project> [options]
```

**Options:**

| Option                  | Description                                             | Default              |
| ----------------------- | ------------------------------------------------------- | -------------------- |
| `--format <formats>`    | Comma-separated list of output formats (json, md, etc.) | `json,md`            |
| `--output <dir>`        | Directory to save reports in                            | `./analysis-results` |
| `--exclude <patterns>`  | Comma-separated glob patterns to exclude                | (none)               |
| `--confidence <number>` | Minimum confidence threshold for findings (0-100)       | `80`                 |

### `bundle-scan`

Analyze the real bundle size impact of unused code with webpack stats integration.

```bash
npx vibealive bundle-scan <path-to-project> [options]
```

**Options:**

| Option                | Description                                             | Default              |
| --------------------- | ------------------------------------------------------- | -------------------- |
| `--format <formats>`  | Comma-separated list of output formats (json, md, etc.) | `json,md`            |
| `--output <dir>`      | Directory to save reports in                            | `./analysis-results` |
| `--build-path <path>` | Path to build output directory with webpack stats       | (auto-detected)      |

**Example:**

```bash
# Basic bundle analysis
npx vibealive bundle-scan .

# With custom build path
npx vibealive bundle-scan . --build-path ./dist

# Generate detailed reports
npx vibealive bundle-scan . --format json,md --output ./bundle-reports
```

This command provides real bundle size impact analysis by parsing webpack stats to show exact bytes that can be saved by removing unused code. See [bundle-analysis.md](./bundle-analysis.md) for detailed documentation.

### Focused Analysis Commands

VibeAlive provides specialized analysis commands for specific areas:

```bash
# Analyze theme configuration and dark mode setup
npx vibealive theme-scan <path>

# Comprehensive SEO audit
npx vibealive seo-scan <path>

# Performance analysis
npx vibealive perf-scan <path>

# WCAG 2.2 Accessibility Audit
npx vibealive a11y-scan <path>

Performs a comprehensive accessibility audit based on WCAG 2.2 guidelines including:

- **Image Accessibility**: Alt text validation, decorative image handling
- **Semantic HTML**: Proper heading hierarchy, landmark usage, table structure
- **ARIA Implementation**: Labels, roles, properties, live regions
- **Keyboard Navigation**: Focus management, tab order, keyboard shortcuts
- **Color & Contrast**: Minimum contrast ratios, color-only information
- **Form Accessibility**: Labels, input purpose, error handling
- **Focus Management**: Visible indicators, focus not obscured (new in WCAG 2.2)
- **Motion & Interaction**: Reduced motion, pointer gestures, drag alternatives
- **Authentication**: Accessible auth methods (new in WCAG 2.2)
- **Next.js Specific**: Image component usage, Link components, metadata

# Advanced Next.js patterns detection
npx vibealive patterns <path>

# Common package analysis
npx vibealive packages <path>

# Overall project health score
npx vibealive health <path>
```

### `serve`

Start the MCP server for programmatic access.

```bash
npx vibealive serve [options]
```

**Options:**

| Option                | Description                                             | Default |
| --------------------- | ------------------------------------------------------- | ------- |
| `-p, --port <number>` | HTTP server port                                        | `8080`  |
| `--stdio`             | Use stdio transport (for direct MCP client integration) | false   |
| `--legacy`            | Use legacy API format (deprecated, for compatibility)   | false   |

**Transport Modes:**

1. **HTTP Transport** (default): Best for web-based clients and remote access
2. **Stdio Transport**: Best for direct MCP client integration, recommended for CLI tools

### Testing MCP Integration

To validate MCP server compatibility:

```bash
npm run validate-mcp
```

This tests both stdio and HTTP transports for full MCP client compatibility.

## Example Usage

```bash
# Basic analysis
npx vibealive analyze .

# Analysis with custom options
npx vibealive analyze ./my-project --confidence 90 --exclude "**/test/**"

# Start MCP server
npx vibealive serve --stdio
npx vibealive serve --port 3000

# Focused scans
npx vibealive theme-scan .
npx vibealive health .
```

## Package Manager Support

VibeAlive works with all major Node.js package managers:

```bash
# npm
npx vibealive analyze .

# Yarn
yarn dlx vibealive analyze .

# pnpm
pnpx vibealive analyze .

# Bun
bunx vibealive analyze .
```

See [overview.md](./overview.md) and [mcp.md](./mcp.md) for more details.
