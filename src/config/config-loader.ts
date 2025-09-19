import * as fs from 'fs-extra';
import * as path from 'path';
import { AnalysisConfig, CLIOptions } from '../types';

export class ConfigLoader {
  public static async loadConfig(
    projectRoot: string,
    cliOptions: CLIOptions = {}
  ): Promise<AnalysisConfig> {
    // Try to load config file
    const configFile = await this.findConfigFile(projectRoot);
    let fileConfig: Partial<AnalysisConfig> = {};

    if (configFile) {
      fileConfig = await this.loadConfigFile(configFile);
    }

    // Detect project structure
    const projectStructure = await this.detectProjectStructure(projectRoot);

    // Merge configs: CLI options override file config
    const config: AnalysisConfig = {
      projectRoot,
      nextVersion: projectStructure.nextVersion,
      routerType: projectStructure.routerType,
      typescript: projectStructure.typescript,
      excludePatterns: [
        'node_modules/**',
        '.next/**',
        'out/**',
        'dist/**',
        'build/**',
        '.git/**',
        'coverage/**',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/*.stories.{js,jsx,ts,tsx}',
        '**/__tests__/**',
        '**/.storybook/**',
        ...(fileConfig.excludePatterns || []),
        ...(cliOptions.exclude || []),
      ],
      includePatterns: [
        '**/*.{js,jsx,ts,tsx}',
        ...(fileConfig.includePatterns || []),
        ...(cliOptions.include || [])
      ],
      plugins: cliOptions.plugins || fileConfig.plugins || [],
      confidenceThreshold: cliOptions.confidenceThreshold || fileConfig.confidenceThreshold || 80,
      outputFormats: cliOptions.format || fileConfig.outputFormats || ['json', 'md'],
      generateGraph: cliOptions.generateGraph ?? fileConfig.generateGraph ?? true,
    };

    return config;
  }

  private static async findConfigFile(projectRoot: string): Promise<string | null> {
    const configFiles = [
      '.vibealive.config.js',
      '.vibealive.config.mjs',
      '.vibealive.config.ts',
      'vibealive.config.js',
      'vibealive.config.mjs',
      'vibealive.config.ts',
      'next-analyzer.config.js',
      'next-analyzer.config.mjs',
      'next-analyzer.config.ts',
      '.next-analyzer.config.js',
      '.next-analyzer.config.mjs',
      '.next-analyzer.config.ts',
    ];

    for (const configFile of configFiles) {
      const filePath = path.join(projectRoot, configFile);
      if (await fs.pathExists(filePath)) {
        return filePath;
      }
    }

    return null;
  }

  private static async loadConfigFile(configPath: string): Promise<Partial<AnalysisConfig>> {
    try {
      // For now, we'll just read JS config files
      // In a real implementation, we'd handle TS compilation
      if (configPath.endsWith('.js') || configPath.endsWith('.mjs')) {
        delete require.cache[path.resolve(configPath)];
        const config = require(path.resolve(configPath));
        return config.default || config;
      }

      // For TypeScript files, we'd need to compile them first
      if (configPath.endsWith('.ts')) {
        console.warn('TypeScript config files are not yet supported. Please use .js or .mjs');
        return {};
      }

      return {};
    } catch (error) {
      console.warn(`Failed to load config file ${configPath}:`, error);
      return {};
    }
  }

  private static async detectProjectStructure(projectRoot: string): Promise<{
    nextVersion: string;
    routerType: 'app' | 'pages' | 'hybrid';
    typescript: boolean;
  }> {
    const packageJsonPath = path.join(projectRoot, 'package.json');

    if (!(await fs.pathExists(packageJsonPath))) {
      throw new Error('package.json not found. Is this a Next.js project?');
    }

    const packageJson = await fs.readJson(packageJsonPath);
    const nextVersion = this.extractNextVersion(packageJson);

    if (!nextVersion) {
      throw new Error('Next.js not found in dependencies. Is this a Next.js project?');
    }

    const hasAppDir = await fs.pathExists(path.join(projectRoot, 'app'));
    const hasPagesDir = await fs.pathExists(path.join(projectRoot, 'pages'));
    const hasTypeScript = await fs.pathExists(path.join(projectRoot, 'tsconfig.json'));

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

    return {
      nextVersion,
      routerType,
      typescript: hasTypeScript,
    };
  }

  private static extractNextVersion(packageJson: any): string | null {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    const nextDep = dependencies.next;
    if (!nextDep) return null;

    // Clean version string (remove ^, ~, etc.)
    return nextDep.replace(/[\^~]/, '');
  }

  public static generateSampleConfig(): string {
    return `// .vibealive.config.js
module.exports = {
  // Files to exclude from analysis
  exclude: [
    "**/*.test.ts",
    "**/*.stories.tsx",
    "**/temp/**",
    "**/backup/**"
  ],
  
  // Additional file patterns to include
  include: [
    "**/*.mdx"
  ],
  
  // Plugins to enable
  plugins: [
    "tailwind",
    "supabase",
    "stripe"
  ],
  
  // Minimum confidence threshold for recommendations
  confidenceThreshold: 85,
  
  // Generate dependency graph visualization
  generateGraph: true,
  
  // Output formats to generate
  outputFormats: ["json", "md", "tsv"]
};`;
  }
}
