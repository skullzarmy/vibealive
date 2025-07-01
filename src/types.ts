export type OutputFormat = 'json' | 'md' | 'tsv' | 'csv';

export interface AnalysisConfig {
  projectRoot: string;
  nextVersion: string;
  routerType: 'app' | 'pages' | 'hybrid';
  typescript: boolean;
  excludePatterns: string[];
  includePatterns: string[];
  plugins?: string[];
  confidenceThreshold?: number;
  outputFormats?: OutputFormat[];
  generateGraph?: boolean;
}

export type FileClassification = 'ACTIVE' | 'UNUSED' | 'DEAD_CODE' | 'AUTO_INVOKED' | 'UNTRACKED';

export type ComponentType =
  | 'page'
  | 'layout'
  | 'loading'
  | 'error'
  | 'not-found'
  | 'hook'
  | 'config'
  | 'util'
  | 'component'
  | 'api'
  | 'lib'
  | 'auto-invoked'
  | 'asset';

export type FileType = ComponentType; // FileType is now an alias for ComponentType

export interface FileAnalysis {
  path: string;
  type: FileType;
  importCount: number;
  exportCount: number;
  usageLocations: Reference[];
  classification: FileClassification;
  confidence: number;
  reasons: string[];
  bundleSize?: number;
}

export interface APIEndpoint {
  path: string; // e.g., '/api/users/[id]'
  filePath: string; // e.g., 'app/api/users/[id]/route.ts'
  methods: HTTPMethod[]; // ['GET', 'POST', 'DELETE']
  callSites: Reference[];
  dynamicSegments: string[]; // ['id'] for /users/[id]
  classification: 'ACTIVE' | 'UNUSED' | 'REDUNDANT';
  serverActions?: boolean; // Next.js 13+ Server Actions
  confidence: number;
  reasons: string[];
}

export interface ComponentGraph {
  nodes: ComponentNode[];
  edges: DependencyEdge[];
  cycles: ComponentNode[][]; // Circular dependencies
  orphans: ComponentNode[]; // Unreachable components
  entryPoints: ComponentNode[]; // page.tsx, layout.tsx, etc.
}

export interface ComponentNode {
  id: string;
  path: string;
  name: string;
  type: ComponentType;
  exports: ExportInfo[];
  imports: ImportInfo[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'dynamic-import' | 'lazy-import';
  importName?: string;
}

export interface Reference {
  filePath: string;
  line: number;
  column: number;
  type: 'import' | 'usage' | 'export';
  context?: string;
  apiPath?: string; // Add this line
}

export interface ProjectStructure {
  nextVersion: string;
  routerType: 'app' | 'pages' | 'hybrid';
  typescript: boolean;
  hasAppDir: boolean;
  hasPagesDir: boolean;
  configFiles: string[];
  entryPoints: string[];
  publicAssets: string[];
}

export interface AnalysisReport {
  metadata: ReportMetadata;
  files: FileAnalysis[];
  components: ComponentNode[];
  apiEndpoints: APIEndpoint[];
  graph: ComponentGraph;
  summary: AnalysisSummary;
  recommendations: Recommendation[];
}

export interface ReportMetadata {
  projectRoot: string;
  nextVersion: string;
  routerType: 'app' | 'pages' | 'hybrid';
  analysisDate: string;
  totalFiles: number;
  totalComponents: number;
  totalApiEndpoints: number;
  configHash: string;
}

export interface AnalysisSummary {
  unusedFiles: number;
  deadCode: number;
  redundantApis: number;
  safeDeletions: string[];
  potentialSavings: {
    filesCount: number;
    estimatedBundleSize: number;
  };
}

export interface Recommendation {
  type: 'DELETE' | 'REFACTOR' | 'OPTIMIZE' | 'MIGRATE';
  target: string;
  confidence: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  actions: string[];
}

export interface ExportInfo {
  name: string;
  type: 'default' | 'named';
  isTypeOnly?: boolean;
}

export interface ImportInfo {
  source: string;
  imports: Array<{
    name: string;
    alias?: string;
    isTypeOnly?: boolean;
  }>;
  isDynamic?: boolean;
  isLazy?: boolean;
}

export interface AnalysisPlugin {
  name: string;
  analyze(context: AnalysisContext): Promise<PluginResult>;
}

export interface AnalysisContext {
  config: AnalysisConfig;
  projectStructure: ProjectStructure;
  files: string[];
  graph: ComponentGraph;
}

export interface PluginResult {
  findings: FileAnalysis[];
  recommendations: Recommendation[];
  metadata?: Record<string, any>;
}

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface CLIOptions {
  format?: OutputFormat[];
  output?: string;
  exclude?: string[];
  include?: string[];
  confidenceThreshold?: number;
  generateGraph?: boolean;
  plugins?: string[];
  verbose?: boolean;
  dryRun?: boolean;
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  message: string;
  result?: AnalysisReport;
  error?: string;
}
