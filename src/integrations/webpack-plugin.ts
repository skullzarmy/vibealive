import { NextJSAnalyzer } from '../analyzer';
import { ConfigLoader } from '../config/config-loader';
import { ReportGenerator } from '../generators/report-generator';
import type { AnalysisConfig, OutputFormat, FileAnalysis, APIEndpoint } from '../types';

// Simple types to avoid webpack dependency
interface WebpackCompiler {
  context: string;
  hooks: {
    afterEmit: {
      tapAsync: (
        name: string,
        callback: (compilation: WebpackCompilation, callback: (err?: Error) => void) => void
      ) => void;
    };
  };
}

interface WebpackCompilation {
  errors: Error[];
  warnings: Error[];
}

export interface VibeAliveWebpackPluginOptions {
  /** Path to the project to analyze (defaults to webpack context) */
  projectPath?: string;
  /** Confidence threshold for findings (0-100) */
  confidenceThreshold?: number;
  /** Patterns to exclude from analysis */
  exclude?: string[];
  /** Whether to fail the build on findings */
  failOnError?: boolean;
  /** Whether to show warnings for findings */
  showWarnings?: boolean;
  /** Output directory for reports */
  outputDir?: string;
  /** Report formats to generate */
  formats?: OutputFormat[];
  /** Only run in specific environments */
  environments?: string[];
}

export class VibeAliveWebpackPlugin {
  private options: Required<VibeAliveWebpackPluginOptions>;

  constructor(options: VibeAliveWebpackPluginOptions = {}) {
    this.options = {
      projectPath: options.projectPath || process.cwd(),
      confidenceThreshold: options.confidenceThreshold || 80,
      exclude: options.exclude || ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      failOnError: options.failOnError || false,
      showWarnings: options.showWarnings ?? true,
      outputDir: options.outputDir || './vibealive-reports',
      formats: options.formats || ['json'],
      environments: options.environments || ['production'],
    };
  }

  apply(compiler: WebpackCompiler) {
    const pluginName = 'VibeAliveWebpackPlugin';

    compiler.hooks.afterEmit.tapAsync(
      pluginName,
      async (compilation: WebpackCompilation, callback: (err?: Error) => void) => {
        try {
          // Check if we should run in current environment
          const nodeEnv = process.env.NODE_ENV || 'development';
          if (!this.options.environments.includes(nodeEnv)) {
            callback();
            return;
          }

          const projectPath = this.options.projectPath || compiler.context;

          // Load configuration
          const config = await ConfigLoader.loadConfig(projectPath);

          // Override with plugin options
          const analysisConfig: AnalysisConfig = {
            ...config,
            confidenceThreshold: this.options.confidenceThreshold,
            excludePatterns: [...(config.excludePatterns || []), ...this.options.exclude],
          };

          // Run analysis
          const analyzer = new NextJSAnalyzer(analysisConfig);
          const results = await analyzer.analyze();

          // Generate reports
          const reportGenerator = new ReportGenerator(this.options.outputDir);
          await reportGenerator.generateReports(results, this.options.formats);

          // Handle results
          const unusedFiles = results.files.filter(
            (f: FileAnalysis) => f.classification === 'UNUSED'
          );
          const deadComponents = results.files.filter(
            (f: FileAnalysis) => f.classification === 'DEAD_CODE'
          );
          const unusedApis =
            results.apiEndpoints.filter((r: APIEndpoint) => r.classification === 'UNUSED') || [];

          const totalIssues = unusedFiles.length + deadComponents.length + unusedApis.length;

          if (totalIssues > 0) {
            const message =
              `VibeAlive found ${totalIssues} potential issues:\n` +
              `  - ${unusedFiles.length} unused files\n` +
              `  - ${deadComponents.length} dead components\n` +
              `  - ${unusedApis.length} unused API routes\n` +
              `  Reports saved to: ${this.options.outputDir}`;

            if (this.options.failOnError) {
              compilation.errors.push(new Error(message));
            } else if (this.options.showWarnings) {
              compilation.warnings.push(new Error(message));
            }
          } else if (this.options.showWarnings) {
            compilation.warnings.push(new Error('VibeAlive: No unused code detected! 🎉'));
          }

          callback();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (this.options.failOnError) {
            callback(new Error(`VibeAlive analysis failed: ${errorMessage}`));
          } else {
            compilation.warnings.push(new Error(`VibeAlive analysis failed: ${errorMessage}`));
            callback();
          }
        }
      }
    );
  }
}
