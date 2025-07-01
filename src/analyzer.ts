import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'fast-glob';
import * as semver from 'semver';
import {
  AnalysisConfig,
  AnalysisReport,
  ProjectStructure,
  FileAnalysis,
  ComponentGraph,
  APIEndpoint,
  ComponentNode,
  DependencyEdge,
  Reference,
  AnalysisSummary,
  Recommendation,
  AnalysisPlugin,
  AnalysisContext,
} from './types';
import { FileScanner, ScannedFile } from './scanners/file-scanner';
import { DependencyAnalyzer } from './analyzers/dependency-analyzer';
import { APIAnalyzer } from './analyzers/api-analyzer';

export class NextJSAnalyzer {
  private config: AnalysisConfig;
  private plugins: AnalysisPlugin[] = [];
  private projectStructure?: ProjectStructure;

  constructor(config: AnalysisConfig) {
    this.config = config;
    this.loadPlugins();
  }

  public async analyze(): Promise<AnalysisReport> {
    try {
      console.log('🔍 Analyzing Next.js project...');

      // Step 1: Detect project structure
      console.log('📁 Detecting project structure...');
      this.projectStructure = await this.detectProjectStructure();

      // Step 2: Scan all files
      console.log('📄 Scanning files...');
      const scanner = new FileScanner(this.config, this.projectStructure);
      const files = await scanner.scanFiles();

      // Step 3: Build dependency graph and identify orphans
      console.log('🕸️  Building dependency graph...');
      const dependencyAnalyzer = new DependencyAnalyzer(this.config, this.projectStructure);
      const graph = await dependencyAnalyzer.buildDependencyGraph(files);

      // Step 4: Analyze API endpoints
      console.log('🔌 Analyzing API endpoints...');
      const apiAnalyzer = new APIAnalyzer(this.config, this.projectStructure);
      const apiEndpoints = await apiAnalyzer.analyzeAPIs(files);

      // Step 5: Consolidate analysis from the dependency graph (REPLACES UsageAnalyzer)
      console.log('🎯 Consolidating file analysis...');
      const fileAnalyses = this.consolidateFileAnalysis(graph, files);

      // Step 6: Run plugins
      console.log('🔧 Running plugins...');
      const pluginResults = await this.runPlugins({
        config: this.config,
        projectStructure: this.projectStructure,
        files: files.map((f) => f.path),
        graph,
      });

      // Step 7: Generate summary and recommendations
      console.log('📊 Generating analysis summary...');
      const summary = this.generateSummary(fileAnalyses, apiEndpoints);
      const recommendations = this.generateRecommendations(
        fileAnalyses,
        apiEndpoints,
        pluginResults
      );

      const report: AnalysisReport = {
        metadata: {
          projectRoot: this.config.projectRoot,
          nextVersion: this.projectStructure.nextVersion,
          routerType: this.projectStructure.routerType,
          analysisDate: new Date().toISOString(),
          totalFiles: files.length,
          totalComponents: graph.nodes.length,
          totalApiEndpoints: apiEndpoints.length,
          configHash: this.generateConfigHash(),
        },
        files: fileAnalyses,
        components: graph.nodes,
        apiEndpoints,
        graph,
        summary,
        recommendations,
      };

      console.log('✅ Analysis complete!');
      return report;
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }

  public getFileDetails(filePath: string): FileAnalysis | null {
    // This is a placeholder implementation. A real implementation would need
    // to be more efficient and likely synchronous.
    const report = this.analyze(); // This is not ideal
    return null; // Placeholder
  }

  public getDependencyInfo(filePath: string): any | null {
    // This is a placeholder implementation.
    return null; // Placeholder
  }

  private resolveImport(source: string, fromPath: string): string | null {
    // This is a simplified version. In a real implementation, this would use the
    // same robust logic as the DependencyAnalyzer.
    const fromDir = path.dirname(fromPath);
    const resolved = path.resolve(fromDir, source);
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      if (fs.existsSync(resolved + ext)) return resolved + ext;
      if (fs.existsSync(path.join(resolved, 'index' + ext)))
        return path.join(resolved, 'index' + ext);
    }
    return null;
  }

  private consolidateFileAnalysis(graph: ComponentGraph, allFiles: ScannedFile[]): FileAnalysis[] {
    const orphanPaths = new Set(graph.orphans.map((o) => o.path));
    const allAnalyzedPaths = new Set(graph.nodes.map((n) => n.path));

    return allFiles.map((file) => {
      const node = graph.nodes.find((n) => n.path === file.path);
      const isOrphan = orphanPaths.has(file.path);
      const isAnalyzed = allAnalyzedPaths.has(file.path);

      if (!isAnalyzed) {
        return {
          path: file.path,
          type: 'asset',
          importCount: 0,
          exportCount: 0,
          usageLocations: [],
          classification: 'UNTRACKED',
          confidence: 0,
          reasons: ['File type is not analyzable for code usage (e.g., image, css, markdown).'],
          bundleSize: file.size,
        };
      }

      const classification = isOrphan ? 'UNUSED' : 'ACTIVE';
      const confidence = isOrphan ? 80 : 100;
      const reasons = isOrphan
        ? ['File is not imported by any other reachable file.']
        : ['File is part of the active dependency graph.'];

      return {
        path: file.path,
        type: node!.type,
        importCount: node!.imports.length,
        exportCount: node!.exports.length,
        usageLocations: [], // This can be populated later if needed
        classification,
        confidence,
        reasons,
        bundleSize: file.size,
      };
    });
  }

  private async detectProjectStructure(): Promise<ProjectStructure> {
    const packageJsonPath = path.join(this.config.projectRoot, 'package.json');

    if (!(await fs.pathExists(packageJsonPath))) {
      throw new Error('package.json not found. Is this a Next.js project?');
    }

    const packageJson = await fs.readJson(packageJsonPath);
    const nextVersion = this.extractNextVersion(packageJson);

    if (!nextVersion) {
      throw new Error('Next.js not found in dependencies. Is this a Next.js project?');
    }

    const hasAppDir = await fs.pathExists(path.join(this.config.projectRoot, 'app'));
    const hasPagesDir = await fs.pathExists(path.join(this.config.projectRoot, 'pages'));

    let routerType: 'app' | 'pages' | 'hybrid';
    if (hasAppDir && hasPagesDir) {
      routerType = 'hybrid';
    } else if (hasAppDir) {
      routerType = 'app';
    } else if (hasPagesDir) {
      routerType = 'pages';
    } else {
      throw new Error('Neither app/ nor pages/ directory found. Is this a Next.js project?');
    }

    const configFiles = await this.findConfigFiles();
    const entryPoints = await this.findEntryPoints(routerType);
    const publicAssets = await this.findPublicAssets();

    const typescript = await fs.pathExists(path.join(this.config.projectRoot, 'tsconfig.json'));

    return {
      nextVersion,
      routerType,
      typescript,
      hasAppDir,
      hasPagesDir,
      configFiles,
      entryPoints,
      publicAssets,
    };
  }

  private extractNextVersion(packageJson: any): string | null {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    const nextDep = dependencies.next;
    if (!nextDep) return null;

    // Clean version string (remove ^, ~, etc.)
    const cleanVersion = nextDep.replace(/[\^~]/, '');
    return semver.valid(cleanVersion) || cleanVersion;
  }

  private async findConfigFiles(): Promise<string[]> {
    const configPatterns = [
      'next.config.*',
      'tailwind.config.*',
      'tsconfig.json',
      'jsconfig.json',
      '.eslintrc.*',
      'prettier.config.*',
      '.prettierrc.*',
    ];

    const configFiles: string[] = [];

    for (const pattern of configPatterns) {
      const files = await glob(pattern, {
        cwd: this.config.projectRoot,
        absolute: true,
      });
      configFiles.push(...files);
    }

    return configFiles;
  }

  private async findEntryPoints(routerType: 'app' | 'pages' | 'hybrid'): Promise<string[]> {
    const entryPoints: string[] = [];

    if (routerType === 'app' || routerType === 'hybrid') {
      const appEntryPatterns = [
        'app/**/page.{js,jsx,ts,tsx}',
        'app/**/layout.{js,jsx,ts,tsx}',
        'app/**/loading.{js,jsx,ts,tsx}',
        'app/**/error.{js,jsx,ts,tsx}',
        'app/**/not-found.{js,jsx,ts,tsx}',
        'app/**/route.{js,ts}',
        'app/**/template.{js,jsx,ts,tsx}',
        'app/**/default.{js,jsx,ts,tsx}',
        'app/**/global-error.{js,jsx,ts,tsx}',
        // Special App Router files
        'app/**/sitemap.{js,ts}',
        'app/**/robots.{js,ts}',
        'app/**/manifest.{js,ts}',
        'app/**/favicon.{ico,png,svg}',
        'app/**/icon.{js,ts,tsx,png,svg,ico}',
        'app/**/apple-icon.{js,ts,tsx,png,svg,ico}',
        'app/**/opengraph-image.{js,ts,tsx,png,jpg,jpeg}',
        'app/**/twitter-image.{js,ts,tsx,png,jpg,jpeg}',
      ];

      for (const pattern of appEntryPatterns) {
        const files = await glob(pattern, {
          cwd: this.config.projectRoot,
          absolute: true,
        });
        entryPoints.push(...files);
      }
    }

    if (routerType === 'pages' || routerType === 'hybrid') {
      const pagesEntryPatterns = ['pages/**/*.{js,jsx,ts,tsx}', 'pages/api/**/*.{js,ts}'];

      for (const pattern of pagesEntryPatterns) {
        const files = await glob(pattern, {
          cwd: this.config.projectRoot,
          absolute: true,
        });
        entryPoints.push(...files);
      }
    }

    // Add middleware
    const middlewareFiles = await glob('middleware.{js,ts}', {
      cwd: this.config.projectRoot,
      absolute: true,
    });
    entryPoints.push(...middlewareFiles);

    // Add essential configuration and system files
    const essentialPatterns = [
      // Next.js essentials
      'next.config.*',
      'next-env.d.ts',

      // Package and project files
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'tsconfig.json',
      'jsconfig.json',

      // Environment files
      '.env*',

      // Build tool configs
      'tailwind.config.*',
      'postcss.config.*',
      '.eslintrc.*',
      'eslint.config.*',
      '.prettierrc.*',
      'prettier.config.*',

      // Testing configs
      'jest.config.*',
      'vitest.config.*',
      'playwright.config.*',

      // Other common configs
      'babel.config.*',
      '.babelrc*',
      'webpack.config.*',
      'vite.config.*',

      // TypeScript declaration files (they provide type information)
      '**/*.d.ts',

      // Git and project files
      '.gitignore',
      '.gitattributes',
      'README.md',
      'LICENSE',

      // Vercel/deployment
      'vercel.json',
    ];

    for (const pattern of essentialPatterns) {
      const files = await glob(pattern, {
        cwd: this.config.projectRoot,
        absolute: true,
        dot: true, // Include dotfiles
      });
      entryPoints.push(...files);
    }

    return [...new Set(entryPoints)]; // Remove duplicates
  }

  private async findPublicAssets(): Promise<string[]> {
    const publicDir = path.join(this.config.projectRoot, 'public');

    if (!(await fs.pathExists(publicDir))) {
      return [];
    }

    const assets = await glob('**/*', {
      cwd: publicDir,
      absolute: true,
      onlyFiles: true,
    });

    return assets;
  }

  private loadPlugins(): void {
    // Plugin loading will be implemented based on config
    // For now, we'll have empty plugins array
    this.plugins = [];
  }

  private async runPlugins(context: AnalysisContext): Promise<any[]> {
    const results = [];

    for (const plugin of this.plugins) {
      try {
        const result = await plugin.analyze(context);
        results.push(result);
      } catch (error) {
        console.warn(`Plugin ${plugin.name} failed:`, error);
      }
    }

    return results;
  }

  private generateSummary(
    fileAnalyses: FileAnalysis[],
    apiEndpoints: APIEndpoint[]
  ): AnalysisSummary {
    const unusedFiles = fileAnalyses.filter((f) => f.classification === 'UNUSED').length;
    const deadCode = fileAnalyses.filter((f) => f.classification === 'DEAD_CODE').length;
    const redundantApis = apiEndpoints.filter((api) => api.classification === 'REDUNDANT').length;

    const safeDeletions = fileAnalyses
      .filter((f) => f.classification === 'UNUSED' && f.confidence > 90)
      .map((f) => f.path);

    const estimatedBundleSize = fileAnalyses
      .filter((f) => f.classification === 'UNUSED' || f.classification === 'DEAD_CODE')
      .reduce((total, f) => total + (f.bundleSize || 0), 0);

    return {
      unusedFiles,
      deadCode,
      redundantApis,
      safeDeletions,
      potentialSavings: {
        filesCount: unusedFiles + deadCode,
        estimatedBundleSize,
      },
    };
  }

  private generateRecommendations(
    fileAnalyses: FileAnalysis[],
    apiEndpoints: APIEndpoint[],
    pluginResults: any[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Add file-based recommendations
    fileAnalyses.forEach((file) => {
      if (file.classification === 'UNUSED' && file.confidence > 80) {
        recommendations.push({
          type: 'DELETE',
          target: file.path,
          confidence: file.confidence,
          impact: file.bundleSize && file.bundleSize > 10000 ? 'HIGH' : 'LOW',
          description: `Unused file with ${file.confidence}% confidence`,
          actions: [`rm "${file.path}"`],
        });
      }
    });

    // Add API-based recommendations
    apiEndpoints.forEach((api) => {
      if (api.classification === 'UNUSED' && api.confidence > 80) {
        recommendations.push({
          type: 'DELETE',
          target: api.filePath,
          confidence: api.confidence,
          impact: 'MEDIUM',
          description: `Unused API endpoint: ${api.path}`,
          actions: [`rm "${api.filePath}"`],
        });
      }
    });

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  private generateConfigHash(): string {
    const configString = JSON.stringify(this.config);
    // Simple hash function for config
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}
