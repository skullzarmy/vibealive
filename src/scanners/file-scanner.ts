import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'fast-glob';
import { AnalysisConfig, ProjectStructure } from '../types';

export interface ScannedFile {
  path: string;
  absolutePath: string;
  relativePath: string;
  size: number;
  extension: string;
  isTypeScript: boolean;
  isReact: boolean;
  content?: string;
  ast?: any;
}

export class FileScanner {
  constructor(
    private config: AnalysisConfig,
    private projectStructure: ProjectStructure
  ) {}

  public async scanFiles(): Promise<ScannedFile[]> {
    const patterns = this.buildScanPatterns();
    const excludePatterns = this.buildExcludePatterns();

    const filePaths = await glob(patterns, {
      cwd: this.config.projectRoot,
      absolute: true,
      ignore: excludePatterns,
    });

    const files: ScannedFile[] = [];

    for (const filePath of filePaths) {
      try {
        const file = await this.processFile(filePath);
        if (file) {
          files.push(file);
        }
      } catch (error) {
        console.warn(`Failed to process file ${filePath}:`, error);
      }
    }

    return files;
  }

  private buildScanPatterns(): string[] {
    // Use custom include patterns if provided, otherwise use defaults
    if (this.config.includePatterns && this.config.includePatterns.length > 0) {
      return [...this.config.includePatterns];
    }
    
    // Default patterns
    return ['**/*.{js,jsx,ts,tsx}', '**/*.{mjs,cjs}', '**/*.json', '**/*.md', '**/*.mdx'];
  }

  private buildExcludePatterns(): string[] {
    const defaultExcludes = [
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
    ];

    // Add custom exclude patterns
    if (this.config.excludePatterns) {
      defaultExcludes.push(...this.config.excludePatterns);
    }

    return defaultExcludes;
  }

  private async processFile(filePath: string): Promise<ScannedFile | null> {
    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        return null;
      }

      const relativePath = path.relative(this.config.projectRoot, filePath);
      const extension = path.extname(filePath);
      const isTypeScript = /\.(ts|tsx)$/.test(extension);
      const isReact = /\.(jsx|tsx)$/.test(extension);

      let content: string | undefined;

      // Read content for text files
      if (this.isTextFile(extension)) {
        content = await fs.readFile(filePath, 'utf-8');
      }

      return {
        path: filePath,
        absolutePath: filePath,
        relativePath,
        size: stats.size,
        extension,
        isTypeScript,
        isReact,
        content,
      };
    } catch (error) {
      console.warn(`Error processing file ${filePath}:`, error);
      return null;
    }
  }

  private isTextFile(extension: string): boolean {
    const textExtensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.mjs',
      '.cjs',
      '.json',
      '.md',
      '.mdx',
      '.css',
      '.scss',
      '.sass',
      '.html',
      '.htm',
      '.txt',
      '.yml',
      '.yaml',
      '.env',
    ];

    return textExtensions.includes(extension);
  }

  public async getFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  public isAutoInvokedFile(filePath: string): boolean {
    const relativePath = path.relative(this.config.projectRoot, filePath);
    const filename = path.basename(filePath, path.extname(filePath));
    const fullFileName = path.basename(filePath);

    // App Router auto-invoked files
    if (this.projectStructure.hasAppDir) {
      const appRouterFiles = [
        'page',
        'layout',
        'loading',
        'error',
        'not-found',
        'route',
        'template',
        'default',
        'global-error',
      ];

      if (appRouterFiles.includes(filename) && relativePath.includes('app/')) {
        return true;
      }

      // Special App Router files
      if (
        relativePath.includes('app/') &&
        [
          'sitemap',
          'robots',
          'manifest',
          'favicon',
          'icon',
          'apple-icon',
          'opengraph-image',
          'twitter-image',
        ].includes(filename)
      ) {
        return true;
      }
    }

    // Pages Router auto-invoked files (all files in pages/ are auto-invoked)
    if (this.projectStructure.hasPagesDir && relativePath.includes('pages/')) {
      return true;
    }

    // Middleware
    if (filename === 'middleware') {
      return true;
    }

    // Next.js convention files
    const conventionFiles = ['_app', '_document', '404', '500'];
    if (conventionFiles.includes(filename) && relativePath.includes('pages/')) {
      return true;
    }

    // Essential config and type files
    const essentialPatterns = [
      // Next.js configs
      /next\.config\./,
      /next-env\.d\.ts$/,

      // Build tool configs
      /tailwind\.config\./,
      /postcss\.config\./,
      /eslint\.config\./,
      /prettier\.config\./,
      /\.eslintrc\./,
      /\.prettierrc\./,

      // Package and project files
      /tsconfig\.json$/,
      /jsconfig\.json$/,
      /package\.json$/,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,

      // Environment files
      /\.env$/,
      /\.env\.local$/,
      /\.env\.development$/,
      /\.env\.production$/,

      // TypeScript declaration files
      /\.d\.ts$/,

      // Git and CI files
      /\.gitignore$/,
      /\.gitattributes$/,
      /README\.md$/,
      /LICENSE$/,

      // Vercel/deployment
      /vercel\.json$/,
      /\.vercel\//,

      // Testing configs
      /jest\.config\./,
      /vitest\.config\./,
      /playwright\.config\./,

      // Other common configs
      /babel\.config\./,
      /\.babelrc$/,
      /webpack\.config\./,
      /vite\.config\./,
    ];

    // Check if file matches essential patterns
    if (
      essentialPatterns.some((pattern) => pattern.test(relativePath) || pattern.test(fullFileName))
    ) {
      return true;
    }

    // Root-level configuration files (common convention)
    const isRootLevel = !relativePath.includes('/') && !relativePath.includes('\\');
    if (isRootLevel && /\.(config|rc)\.(js|ts|json|yaml|yml)$/.test(fullFileName)) {
      return true;
    }

    return false;
  }
}
