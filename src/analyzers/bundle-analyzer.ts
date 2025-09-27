import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import type {
  AnalysisConfig,
  BundleAnalysis,
  ModuleSize,
  BundleSizeRecommendation,
} from '../types';

export interface WebpackStatsModule {
  name: string;
  size: number;
  chunks: number[];
  depth?: number;
  issuer?: string;
  reasons?: Array<{
    moduleName: string;
    type: string;
  }>;
}

export interface WebpackStats {
  assets: Array<{
    name: string;
    size: number;
    chunks: number[];
  }>;
  chunks: Array<{
    id: number;
    size: number;
    names: string[];
    files: string[];
  }>;
  modules: WebpackStatsModule[];
  outputPath: string;
}

export class BundleAnalyzer {
  constructor(private config: AnalysisConfig) {}

  public async analyzeBundleImpact(
    unusedFiles: string[],
    buildOutputPath?: string
  ): Promise<BundleAnalysis> {
    try {
      // Try to find webpack stats or generate them
      const statsData = await this.getWebpackStats(buildOutputPath);

      if (!statsData) {
        return this.createFallbackAnalysis(unusedFiles);
      }

      return this.analyzeWithWebpackStats(statsData, unusedFiles);
    } catch (error) {
      console.warn('Bundle analysis failed, using file size estimates:', error);
      return this.createFallbackAnalysis(unusedFiles);
    }
  }

  private async getWebpackStats(buildOutputPath?: string): Promise<WebpackStats | null> {
    // Look for existing stats file
    const possibleStatsPaths = [
      path.join(this.config.projectRoot, 'stats.json'),
      path.join(this.config.projectRoot, '.next/build-stats.json'),
      path.join(this.config.projectRoot, 'dist/stats.json'),
      buildOutputPath ? path.join(buildOutputPath, 'stats.json') : null,
    ].filter(Boolean) as string[];

    for (const statsPath of possibleStatsPaths) {
      if (await fs.pathExists(statsPath)) {
        try {
          return await fs.readJson(statsPath);
        } catch (error) {
          console.warn(`Failed to read stats file ${statsPath}:`, error);
        }
      }
    }

    // Try to generate stats if we have a build script
    return this.tryGenerateStats();
  }

  private async tryGenerateStats(): Promise<WebpackStats | null> {
    try {
      const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
      if (!(await fs.pathExists(packageJsonPath))) {
        return null;
      }

      const packageJson = await fs.readJson(packageJsonPath);
      const buildScript = packageJson.scripts?.build;

      if (!buildScript) {
        return null;
      }

      // Check if it's a Next.js project
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        return this.generateNextJsStats();
      }

      // Try generic webpack stats generation
      return this.generateWebpackStats();
    } catch (error) {
      console.warn('Failed to generate webpack stats:', error);
      return null;
    }
  }

  private async generateNextJsStats(): Promise<WebpackStats | null> {
    try {
      const statsPath = path.join(this.config.projectRoot, 'vibealive-stats.json');

      // Create a temporary next.config.js that exports stats
      const tempConfigPath = path.join(this.config.projectRoot, 'vibealive-next.config.js');
      const tempConfig = `
const path = require('path');
const originalConfig = ${await this.getExistingNextConfig()};

module.exports = {
  ...originalConfig,
  webpack: (config, options) => {
    // Call original webpack function if it exists
    if (originalConfig.webpack) {
      config = originalConfig.webpack(config, options);
    }
    
    // Add stats generation
    if (!options.dev && !options.isServer) {
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.done.tap('VibeAliveStatsPlugin', (stats) => {
            const statsJson = stats.toJson({ all: true });
            require('fs').writeFileSync('${statsPath}', JSON.stringify(statsJson, null, 2));
          });
        }
      });
    }
    
    return config;
  }
};
`;

      await fs.writeFile(tempConfigPath, tempConfig);

      // Run build with temporary config
      const buildCommand = `NEXT_CONFIG_FILE=${tempConfigPath} npm run build`;
      execSync(buildCommand, {
        cwd: this.config.projectRoot,
        stdio: 'pipe',
      });

      // Read generated stats
      if (await fs.pathExists(statsPath)) {
        const stats = await fs.readJson(statsPath);

        // Cleanup
        await fs.remove(tempConfigPath);
        await fs.remove(statsPath);

        return stats;
      }

      await fs.remove(tempConfigPath);
      return null;
    } catch (error) {
      console.warn('Failed to generate Next.js stats:', error);
      return null;
    }
  }

  private async getExistingNextConfig(): Promise<string> {
    const configPaths = ['next.config.js', 'next.config.mjs', 'next.config.ts'];

    for (const configPath of configPaths) {
      const fullPath = path.join(this.config.projectRoot, configPath);
      if (await fs.pathExists(fullPath)) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          // Extract the exported config (simplified)
          return content.includes('module.exports') ? 'require("./next.config.js")' : '{}';
        } catch (error) {
          console.warn(`Failed to read ${configPath}:`, error);
        }
      }
    }
    return '{}';
  }

  private async generateWebpackStats(): Promise<WebpackStats | null> {
    try {
      const statsPath = path.join(this.config.projectRoot, 'vibealive-webpack-stats.json');

      // Try to run webpack with stats generation
      const buildCommand = `npx webpack --profile --json > ${statsPath}`;
      execSync(buildCommand, {
        cwd: this.config.projectRoot,
        stdio: 'pipe',
      });

      if (await fs.pathExists(statsPath)) {
        const stats = await fs.readJson(statsPath);
        await fs.remove(statsPath);
        return stats;
      }

      return null;
    } catch (error) {
      console.warn('Failed to generate webpack stats:', error);
      return null;
    }
  }

  private async analyzeWithWebpackStats(
    stats: WebpackStats,
    unusedFiles: string[]
  ): Promise<BundleAnalysis> {
    const moduleBreakdown: ModuleSize[] = [];
    let totalUnusedSize = 0;
    let totalUnusedGzipped = 0;

    // Analyze each module
    for (const module of stats.modules || []) {
      const isUnused = this.isModuleUnused(module, unusedFiles);
      const estimatedGzipped = Math.floor(module.size * 0.3); // Rough gzip estimate

      const moduleSize: ModuleSize = {
        name: module.name,
        size: module.size,
        gzippedSize: estimatedGzipped,
        parsedSize: module.size,
        isUnused,
        path: module.name,
      };

      moduleBreakdown.push(moduleSize);

      if (isUnused) {
        totalUnusedSize += module.size;
        totalUnusedGzipped += estimatedGzipped;
      }
    }

    // Calculate total bundle size
    const totalBundleSize = stats.assets?.reduce((total, asset) => total + asset.size, 0) || 0;
    const estimatedGzippedTotal = Math.floor(totalBundleSize * 0.3);

    const recommendations = this.generateBundleRecommendations(moduleBreakdown);

    return {
      totalBundleSize,
      gzippedSize: estimatedGzippedTotal,
      parsedSize: totalBundleSize,
      unusedCodeSize: totalUnusedSize,
      unusedCodeGzipped: totalUnusedGzipped,
      potentialSavings: {
        bytes: totalUnusedSize,
        gzipped: totalUnusedGzipped,
        percentage: totalBundleSize > 0 ? (totalUnusedSize / totalBundleSize) * 100 : 0,
      },
      moduleBreakdown,
      recommendations,
    };
  }

  private isModuleUnused(module: WebpackStatsModule, unusedFiles: string[]): boolean {
    // Check if module path matches any unused files
    return unusedFiles.some((unusedFile) => {
      const normalizedUnused = path.normalize(unusedFile);
      const normalizedModule = path.normalize(module.name);

      return (
        normalizedModule.includes(normalizedUnused) ||
        normalizedUnused.includes(normalizedModule.replace(/^\.\//, ''))
      );
    });
  }

  private async createFallbackAnalysis(unusedFiles: string[]): Promise<BundleAnalysis> {
    let totalUnusedSize = 0;
    const moduleBreakdown: ModuleSize[] = [];

    // Estimate sizes based on file system
    for (const filePath of unusedFiles) {
      try {
        const fullPath = path.resolve(this.config.projectRoot, filePath);
        const stats = await fs.stat(fullPath);
        const size = stats.size;
        const estimatedGzipped = Math.floor(size * 0.3);

        moduleBreakdown.push({
          name: filePath,
          size,
          gzippedSize: estimatedGzipped,
          parsedSize: size,
          isUnused: true,
          path: filePath,
        });

        totalUnusedSize += size;
      } catch (error) {
        // File might not exist or be readable
        console.warn(`Could not analyze file ${filePath}:`, error);
      }
    }

    const estimatedBundleSize = totalUnusedSize * 10; // Rough estimate
    const totalUnusedGzipped = Math.floor(totalUnusedSize * 0.3);

    return {
      totalBundleSize: estimatedBundleSize,
      gzippedSize: Math.floor(estimatedBundleSize * 0.3),
      parsedSize: estimatedBundleSize,
      unusedCodeSize: totalUnusedSize,
      unusedCodeGzipped: totalUnusedGzipped,
      potentialSavings: {
        bytes: totalUnusedSize,
        gzipped: totalUnusedGzipped,
        percentage: estimatedBundleSize > 0 ? (totalUnusedSize / estimatedBundleSize) * 100 : 0,
      },
      moduleBreakdown,
      recommendations: this.generateFallbackRecommendations(moduleBreakdown),
    };
  }

  private generateBundleRecommendations(modules: ModuleSize[]): BundleSizeRecommendation[] {
    const recommendations: BundleSizeRecommendation[] = [];

    // Find large unused modules
    const largeUnusedModules = modules
      .filter((m) => m.isUnused && m.size > 10000) // > 10KB
      .sort((a, b) => b.size - a.size);

    for (const module of largeUnusedModules.slice(0, 5)) {
      recommendations.push({
        type: 'REMOVE_UNUSED',
        module: module.name,
        currentSize: module.size,
        potentialSaving: module.size,
        description: `Remove unused module "${path.basename(module.name)}" to save ${this.formatBytes(module.size)}`,
        action: `Delete ${module.path} or remove imports`,
      });
    }

    // Find modules that could benefit from code splitting
    const largeSingleModules = modules
      .filter((m) => !m.isUnused && m.size > 100000) // > 100KB
      .sort((a, b) => b.size - a.size);

    for (const module of largeSingleModules.slice(0, 3)) {
      recommendations.push({
        type: 'CODE_SPLIT',
        module: module.name,
        currentSize: module.size,
        potentialSaving: Math.floor(module.size * 0.7), // Estimated saving from splitting
        description: `Code split large module "${path.basename(module.name)}" to improve loading performance`,
        action: 'Implement dynamic imports or route-based splitting',
      });
    }

    return recommendations;
  }

  private generateFallbackRecommendations(modules: ModuleSize[]): BundleSizeRecommendation[] {
    const recommendations: BundleSizeRecommendation[] = [];

    // Focus on largest unused files
    const sortedUnused = modules
      .filter((m) => m.isUnused)
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    for (const module of sortedUnused) {
      recommendations.push({
        type: 'REMOVE_UNUSED',
        module: module.name,
        currentSize: module.size,
        potentialSaving: module.size,
        description: `Remove unused file "${path.basename(module.name)}" to save ${this.formatBytes(module.size)}`,
        action: `Delete ${module.path}`,
      });
    }

    return recommendations;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public async generateBundleReport(analysis: BundleAnalysis): Promise<string> {
    const report = `## 📦 Bundle Size Analysis

### Current Bundle
- **Total Size**: ${this.formatBytes(analysis.totalBundleSize)}
- **Gzipped**: ${this.formatBytes(analysis.gzippedSize)}
- **Unused Code**: ${this.formatBytes(analysis.unusedCodeSize)}

### Potential Savings
- **Bytes**: ${this.formatBytes(analysis.potentialSavings.bytes)}
- **Gzipped**: ${this.formatBytes(analysis.potentialSavings.gzipped)}
- **Percentage**: ${analysis.potentialSavings.percentage.toFixed(1)}%

### Top Unused Modules
${analysis.moduleBreakdown
  .filter((m) => m.isUnused)
  .sort((a, b) => b.size - a.size)
  .slice(0, 10)
  .map((m) => `- \`${m.name}\` - ${this.formatBytes(m.size)}`)
  .join('\n')}

### Bundle Optimization Recommendations
${analysis.recommendations
  .map(
    (rec) => `- **${rec.type}**: ${rec.description} (Save ${this.formatBytes(rec.potentialSaving)})`
  )
  .join('\n')}
`;

    return report;
  }
}
