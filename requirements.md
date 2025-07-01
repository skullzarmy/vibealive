# NEXT.JS Unfucker

## UNIVERSAL NEXT.JS CODE ANALYSIS TOOL - NPM PACKAGE

### Objective

Create a universal, extensible code analysis tool that can intelligently analyze any Next.js application to identify unused files, dead code, and redundant API endpoints. The tool should be framework-aware and adapt to different Next.js versions and routing patterns.

### 🔧 Technical Specifications

#### Framework Detection & Adaptation

**Next.js Version Detection:**

- Parse `package.json` to detect Next.js version (12.x, 13.x, 14.x, 15.x+)
- Analyze configuration files (`next.config.js`, `next.config.mjs`, `next.config.ts`)
- Detect TypeScript vs JavaScript setup

**Routing Pattern Detection:**

- **App Router** (Next.js 13+): Detect `app/` directory structure
- **Pages Router** (Next.js 12-): Detect `pages/` directory structure
- **Hybrid Setup**: Handle projects using both routers

**Framework-Aware File Classification:**

- **Auto-Invoked Files**: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`, `middleware.ts`
- **Convention Files**: `_app.tsx`, `_document.tsx`, `404.tsx`, `500.tsx`
- **Config Files**: `next.config.*`, `tailwind.config.*`, `tsconfig.json`
- **Build Artifacts**: `.next/`, `out/`, `dist/`

#### 🎯 Analysis Modules

**1. Static Analysis Engine**

```typescript
interface AnalysisConfig {
  projectRoot: string;
  nextVersion: string;
  routerType: 'app' | 'pages' | 'hybrid';
  typescript: boolean;
  excludePatterns: string[];
  includePatterns: string[];
}

interface FileAnalysis {
  path: string;
  type: 'component' | 'api' | 'lib' | 'config' | 'auto-invoked';
  importCount: number;
  exportCount: number;
  usageLocations: Reference[];
  classification: 'ACTIVE' | 'UNUSED' | 'DEAD_CODE' | 'AUTO_INVOKED';
  confidence: number; // 0-100 confidence score for removal
  reasons: string[]; // Why it's classified this way
}
```

**2. Dynamic Import Analysis**

- Detect `dynamic()` imports and lazy loading
- Track `React.lazy()` usage
- Handle code splitting patterns
- Analyze conditional imports

**3. API Endpoint Mapping**

```typescript
interface APIEndpoint {
  path: string; // e.g., '/api/users/[id]'
  filePath: string; // e.g., 'app/api/users/[id]/route.ts'
  methods: HTTPMethod[]; // ['GET', 'POST', 'DELETE']
  callSites: Reference[];
  dynamicSegments: string[]; // ['id'] for /users/[id]
  classification: 'ACTIVE' | 'UNUSED' | 'REDUNDANT';
  serverActions?: boolean; // Next.js 13+ Server Actions
}
```

**4. Component Dependency Graph**

```typescript
interface ComponentGraph {
  nodes: ComponentNode[];
  edges: DependencyEdge[];
  cycles: ComponentNode[][]; // Circular dependencies
  orphans: ComponentNode[]; // Unreachable components
  entryPoints: ComponentNode[]; // page.tsx, layout.tsx, etc.
}
```

#### 🧠 Smart Exclusion Rules

**Auto-Invoked Files (Never Flag as Unused):**

- App Router: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`
- API Routes: `route.ts`, `route.js` (in app router)
- Pages Router: `pages/**/*.tsx` (file-based routing)
- Middleware: `middleware.ts`, `middleware.js`
- Config Files: Next.js configs, framework configs

**Context-Aware Analysis:**

- **Public Assets**: Files in `public/` referenced in code or stylesheets
- **Environment Variables**: Track `.env` usage across files
- **MDX Files**: Handle `.mdx` imports and routing
- **CSS Modules**: Track `.module.css` usage
- **Server Actions**: Detect and map Next.js 13+ server actions

#### 📊 Output Formats

**1. JSON Output (Machine Readable)**

```json
{
  "metadata": {
    "projectRoot": "/path/to/project",
    "nextVersion": "15.2.4",
    "routerType": "app",
    "analysisDate": "2025-06-25T10:00:00Z",
    "totalFiles": 247,
    "totalComponents": 89,
    "totalApiEndpoints": 23
  },
  "files": [...],
  "components": [...],
  "apiEndpoints": [...],
  "summary": {
    "unusedFiles": 12,
    "deadCode": 3,
    "redundantApis": 2,
    "safeDeletions": ["file1.ts", "file2.tsx"],
    "recommendations": [...]
  }
}
```

**2. TSV Output (Spreadsheet Friendly)**

```
Type	Path	UsageCount	Classification	Confidence	Reasons
File	lib/unused-util.ts	0	UNUSED	95	No imports found
API	api/legacy/old.ts	0	UNUSED	90	No fetch calls detected
Component	components/OldButton.tsx	0	DEAD_CODE	85	No JSX usage found
```

**3. Markdown Report (Human Readable)**

- Executive summary with statistics
- Detailed findings by category
- Recommended actions with confidence levels
- Dependency visualizations (mermaid diagrams)

#### 🛠 Tool Architecture

**Core Engine:**

```typescript
class NextJSAnalyzer {
  constructor(config: AnalysisConfig) {}

  async analyze(): Promise<AnalysisReport> {
    const project = await this.detectProjectStructure();
    const files = await this.scanFiles();
    const dependencies = await this.buildDependencyGraph();
    const apis = await this.mapApiEndpoints();
    const usage = await this.analyzeUsage();

    return this.generateReport();
  }

  private async detectProjectStructure(): Promise<ProjectStructure> {}
  private async buildDependencyGraph(): Promise<DependencyGraph> {}
  private async analyzeUsage(): Promise<UsageMap> {}
}
```

**Plugin System:**

```typescript
interface AnalysisPlugin {
  name: string;
  analyze(context: AnalysisContext): Promise<PluginResult>;
}

// Built-in plugins
const plugins = [
  new TailwindAnalyzer(),
  new ServerActionsAnalyzer(),
  new MDXAnalyzer(),
  new SupabaseAnalyzer(),
  new StripeAnalyzer(),
];
```

#### 🎯 Advanced Features

**1. Framework Integration Detection**

- **UI Libraries**: Detect shadcn/ui, Material-UI, Chakra usage
- **State Management**: Redux, Zustand, Jotai patterns
- **Authentication**: NextAuth, Supabase Auth, Auth0
- **Database**: Prisma, Drizzle, raw SQL files
- **Styling**: Tailwind, styled-components, CSS modules

**2. Performance Impact Analysis**

- Bundle size impact of unused files
- Lazy loading optimization opportunities
- Tree-shaking effectiveness

**3. Migration Assistance**

- Identify legacy patterns for Next.js upgrades
- App Router migration readiness assessment
- TypeScript migration opportunities

### 📦 Deliverables

**1. Core Tool**

- `scripts/vibealive.ts` - Main analysis engine
- `scripts/vibealive.config.ts` - Configuration schema
- `package.json` dependencies for AST parsing

**2. Output Files**

- `analysis-report.json` - Complete machine-readable data
- `analysis-report.tsv` - Spreadsheet-friendly format
- `analysis-report.md` - Human-readable summary
- `dependency-graph.svg` - Visual dependency map

**3. Configuration**

- `.vibealive.config.js` - Project-specific settings
- CLI arguments for runtime configuration
- Environment-based exclusion rules

### 🧪 Validation & Testing

**Test Suite Requirements:**

- Test against Next.js 12.x (Pages Router)
- Test against Next.js 13.x (App Router)
- Test against Next.js 14.x+ (Latest features)
- Test with TypeScript and JavaScript projects
- Test with various UI libraries and frameworks

**Accuracy Targets:**

- 95%+ accuracy for unused file detection
- 90%+ accuracy for dead component detection
- 85%+ accuracy for redundant API detection
- Zero false positives for auto-invoked files

### 🚀 Usage Examples

**Basic Usage:**

```bash
npx vibealive analyze ./my-next-app
```

**Advanced Usage:**

```bash
npx vibealive analyze ./my-next-app \
  --format json,tsv,md \
  --output ./analysis-results \
  --exclude "**/*.test.ts,**/*.stories.tsx" \
  --confidence-threshold 80
```

**Config File:**

```javascript
// .vibealive.config.js
module.exports = {
  exclude: ['**/*.test.ts', '**/*.stories.tsx'],
  plugins: ['tailwind', 'supabase'],
  confidenceThreshold: 85,
  generateGraph: true,
  outputFormats: ['json', 'md'],
};
```
