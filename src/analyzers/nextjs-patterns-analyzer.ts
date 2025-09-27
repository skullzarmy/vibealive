import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'fast-glob';
import type { AnalysisConfig, ProjectStructure } from '../types';

export interface NextJSPattern {
  type:
    | 'route-group'
    | 'private-folder'
    | 'intercepting-route'
    | 'parallel-route'
    | 'dynamic-route';
  path: string;
  purpose: string;
  isValid: boolean;
  recommendations?: string[];
}

export interface CommonPackage {
  name: string;
  installed: boolean;
  version?: string;
  purpose: string;
  setupStatus: 'complete' | 'partial' | 'missing' | 'misconfigured';
  recommendations: string[];
  criticalFiles: string[];
  foundFiles: string[];
}

export interface SetupIssue {
  category: 'seo' | 'performance' | 'accessibility' | 'security' | 'structure';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  files: string[];
  recommendations: string[];
}

export interface NextJSAnalysis {
  patterns: NextJSPattern[];
  packages: CommonPackage[];
  setupIssues: SetupIssue[];
  projectHealth: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
}

export interface PackageInfo {
  purpose: string;
  criticalFiles: string[];
  setupRecommendations: string[];
}

export class NextJSPatternsAnalyzer {
  private packageJson?: Record<string, unknown>;
  private nextConfigContent?: string;

  constructor(
    private config: AnalysisConfig,
    private projectStructure: ProjectStructure
  ) {}

  public async analyzePatterns(): Promise<NextJSAnalysis> {
    // Load project configuration
    await this.loadProjectConfig();

    const patterns = await this.detectAdvancedPatterns();
    const packages = await this.analyzeCommonPackages();
    const setupIssues = await this.detectSetupIssues();
    const projectHealth = this.calculateProjectHealth(patterns, packages, setupIssues);

    return {
      patterns,
      packages,
      setupIssues,
      projectHealth,
    };
  }

  private async loadProjectConfig(): Promise<void> {
    // Load package.json
    const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      this.packageJson = await fs.readJson(packageJsonPath);
    }

    // Load next.config.js/mjs/ts
    const nextConfigPaths = ['next.config.js', 'next.config.mjs', 'next.config.ts'];

    for (const configPath of nextConfigPaths) {
      const fullPath = path.join(this.config.projectRoot, configPath);
      if (await fs.pathExists(fullPath)) {
        try {
          // Basic parsing - could be enhanced with proper JS/TS parsing
          const content = await fs.readFile(fullPath, 'utf-8');
          // For now, just store the content - could parse with babel later
          this.nextConfigContent = content;
          break;
        } catch (error) {
          console.warn(`Failed to load ${configPath}:`, error);
        }
      }
    }
  }

  private async detectAdvancedPatterns(): Promise<NextJSPattern[]> {
    const patterns: NextJSPattern[] = [];

    if (!this.projectStructure.hasAppDir) {
      return patterns; // Advanced patterns are App Router specific
    }

    const appDirs = [
      path.join(this.config.projectRoot, 'app'),
      path.join(this.config.projectRoot, 'src/app'),
    ];

    for (const appDir of appDirs) {
      if (await fs.pathExists(appDir)) {
        const foundPatterns = await this.scanDirectoryForPatterns(appDir);
        patterns.push(...foundPatterns);
      }
    }

    return patterns;
  }

  private async scanDirectoryForPatterns(appDir: string): Promise<NextJSPattern[]> {
    const patterns: NextJSPattern[] = [];
    const entries = await fs.readdir(appDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirName = entry.name;
      const fullPath = path.join(appDir, dirName);
      const relativePath = path.relative(this.config.projectRoot, fullPath);

      // Route Groups: (group-name)
      if (/^\([^)]+\)$/.test(dirName)) {
        patterns.push({
          type: 'route-group',
          path: relativePath,
          purpose: 'Organizational folder that does not affect URL structure',
          isValid: true,
          recommendations: [
            'Route groups are great for organizing related routes',
            'Consider consistent naming conventions for route groups',
          ],
        });
      }

      // Private Folders: _folder
      if (dirName.startsWith('_')) {
        patterns.push({
          type: 'private-folder',
          path: relativePath,
          purpose: 'Private folder for colocated files (not routable)',
          isValid: true,
          recommendations: [
            'Private folders are perfect for components, utilities, and non-routable files',
            'Keep shared code in private folders to maintain clean architecture',
          ],
        });
      }

      // Parallel Routes: @slot
      if (dirName.startsWith('@')) {
        patterns.push({
          type: 'parallel-route',
          path: relativePath,
          purpose: 'Parallel route slot for simultaneous rendering',
          isValid: true,
          recommendations: [
            'Ensure corresponding default.js file exists for the parallel route',
            'Consider loading states for parallel route slots',
          ],
        });
      }

      // Intercepting Routes: (..), (.), (...), (....)
      if (/^\(\.+\)/.test(dirName)) {
        const interceptType = dirName.match(/^\((\.*)\)/)?.[1] || '';
        const levels = interceptType.length;

        patterns.push({
          type: 'intercepting-route',
          path: relativePath,
          purpose: `Intercepts route ${levels} level${levels > 1 ? 's' : ''} up`,
          isValid: true,
          recommendations: [
            'Intercepting routes are great for modals and overlays',
            'Ensure the intercepted route also exists for direct access',
            'Consider loading and error states for intercepted routes',
          ],
        });
      }

      // Dynamic Routes: [param], [...param], [[...param]]
      if (/^\[/.test(dirName)) {
        let purpose = 'Dynamic route segment';

        if (/^\[\.\.\./.test(dirName)) {
          purpose = 'Catch-all route segment (required)';
        } else if (/^\[\[\.\.\./.test(dirName)) {
          purpose = 'Optional catch-all route segment';
        }

        patterns.push({
          type: 'dynamic-route',
          path: relativePath,
          purpose,
          isValid: this.validateDynamicRoute(dirName),
          recommendations: [
            'Ensure generateStaticParams is implemented for static generation',
            'Add proper TypeScript types for route parameters',
            'Consider implementing notFound() for invalid parameters',
          ],
        });
      }

      // Recursively scan subdirectories
      const subPatterns = await this.scanDirectoryForPatterns(fullPath);
      patterns.push(...subPatterns);
    }

    return patterns;
  }

  private validateDynamicRoute(dirName: string): boolean {
    // Check for valid dynamic route syntax
    const validPatterns = [
      /^\[[a-zA-Z_][a-zA-Z0-9_]*\]$/, // [param]
      /^\[\.\.\.([a-zA-Z_][a-zA-Z0-9_]*)\]$/, // [...param]
      /^\[\[\.\.\.([a-zA-Z_][a-zA-Z0-9_]*)\]\]$/, // [[...param]]
    ];

    return validPatterns.some((pattern) => pattern.test(dirName));
  }

  private async analyzeCommonPackages(): Promise<CommonPackage[]> {
    if (!this.packageJson) return [];

    const commonPackages = this.getCommonNextJSPackages();
    const packages: CommonPackage[] = [];

    const dependencies = (this.packageJson?.dependencies as Record<string, string>) || {};
    const devDependencies = (this.packageJson?.devDependencies as Record<string, string>) || {};
    const allDependencies = {
      ...dependencies,
      ...devDependencies,
    };

    for (const [packageName, packageInfo] of Object.entries(commonPackages)) {
      const installed = packageName in allDependencies;
      const version = allDependencies[packageName];

      let setupStatus: 'complete' | 'partial' | 'missing' | 'misconfigured' = installed
        ? 'partial'
        : 'missing';
      const foundFiles: string[] = [];
      const recommendations: string[] = [];

      if (installed) {
        // Check for setup files
        const setupCheck = await this.checkPackageSetup(packageName, packageInfo);
        setupStatus = setupCheck.status;
        foundFiles.push(...setupCheck.foundFiles);
        recommendations.push(...setupCheck.recommendations);
      } else {
        recommendations.push(`Install ${packageName}: npm install ${packageName}`);
        recommendations.push(...packageInfo.setupRecommendations);
      }

      packages.push({
        name: packageName,
        installed,
        version,
        purpose: packageInfo.purpose,
        setupStatus,
        recommendations,
        criticalFiles: packageInfo.criticalFiles,
        foundFiles,
      });
    }

    return packages;
  }

  private getCommonNextJSPackages(): Record<string, PackageInfo> {
    return {
      'next-themes': {
        purpose: 'Dark/light theme switching with system preference detection',
        criticalFiles: ['providers', 'ThemeProvider', 'useTheme'],
        setupRecommendations: [
          'Wrap your app with ThemeProvider in the root layout',
          'Add theme switching UI component',
          'Configure theme colors in your CSS/Tailwind config',
        ],
      },
      'next-seo': {
        purpose: 'SEO management for meta tags, structured data, and social sharing',
        criticalFiles: ['DefaultSeo', 'NextSeo', 'jsonLd'],
        setupRecommendations: [
          'Add DefaultSeo to _app.js or root layout',
          'Use NextSeo component in individual pages',
          'Configure structured data for better search results',
        ],
      },
      '@next/font': {
        purpose: 'Optimized font loading (legacy - now built into Next.js)',
        criticalFiles: [],
        setupRecommendations: [
          'Migrate to next/font (built into Next.js 13+)',
          'Use font optimization for better performance',
        ],
      },
      'next/font': {
        purpose: 'Built-in font optimization',
        criticalFiles: ['Inter', 'Roboto', 'local fonts'],
        setupRecommendations: [
          'Import fonts in your layout components',
          'Use variable fonts for better performance',
          'Preload critical fonts',
        ],
      },
      '@next/bundle-analyzer': {
        purpose: 'Bundle size analysis and optimization',
        criticalFiles: ['next.config.js'],
        setupRecommendations: [
          'Add bundle analyzer to next.config.js',
          'Run analysis regularly to monitor bundle size',
          'Consider code splitting for large components',
        ],
      },
      'next-auth': {
        purpose: 'Authentication for Next.js applications',
        criticalFiles: ['[...nextauth].js', 'auth.config.js', 'middleware.js'],
        setupRecommendations: [
          'Set up API route for authentication',
          'Configure providers and callbacks',
          'Add middleware for protected routes',
          'Set environment variables for auth secrets',
        ],
      },
      '@auth/nextjs': {
        purpose: 'Next-generation authentication (Auth.js v5)',
        criticalFiles: ['auth.ts', 'middleware.js'],
        setupRecommendations: [
          'Configure auth.ts with providers',
          'Set up middleware for route protection',
          'Add session management to your app',
        ],
      },
      'framer-motion': {
        purpose: 'Animation library for React/Next.js',
        criticalFiles: ['motion components', 'LazyMotion'],
        setupRecommendations: [
          'Use LazyMotion for better performance',
          'Consider server-side rendering implications',
          'Implement reduced motion preferences',
        ],
      },
      tailwindcss: {
        purpose: 'Utility-first CSS framework',
        criticalFiles: ['tailwind.config.js', 'globals.css', 'postcss.config.js'],
        setupRecommendations: [
          'Configure content paths in tailwind.config.js',
          'Add Tailwind directives to your CSS',
          'Set up PostCSS configuration',
        ],
      },
      '@vercel/analytics': {
        purpose: 'Web analytics for Vercel deployments',
        criticalFiles: ['Analytics component'],
        setupRecommendations: [
          'Add Analytics component to root layout',
          'Configure for your deployment environment',
        ],
      },
      '@vercel/speed-insights': {
        purpose: 'Real user monitoring for performance',
        criticalFiles: ['SpeedInsights component'],
        setupRecommendations: [
          'Add SpeedInsights to root layout',
          'Monitor Core Web Vitals regularly',
        ],
      },
    };
  }

  private async checkPackageSetup(
    packageName: string,
    _packageInfo: PackageInfo
  ): Promise<{
    status: 'complete' | 'partial' | 'misconfigured';
    foundFiles: string[];
    recommendations: string[];
  }> {
    const foundFiles: string[] = [];
    const recommendations: string[] = [];
    let hasBasicSetup = false;
    let hasAdvancedSetup = false;

    // Check for common setup patterns based on package
    switch (packageName) {
      case 'next-themes':
        hasBasicSetup = await this.checkForPattern(['ThemeProvider', 'useTheme', 'next-themes']);
        if (hasBasicSetup) {
          hasAdvancedSetup = await this.checkForPattern([
            'data-theme',
            'theme-',
            'dark:',
            'system',
          ]);
        } else {
          recommendations.push('Add ThemeProvider to your root layout');
        }
        break;

      case 'tailwindcss': {
        const tailwindConfig =
          (await this.checkFileExists('tailwind.config.js')) ||
          (await this.checkFileExists('tailwind.config.ts'));
        const hasDirectives = await this.checkForPattern([
          '@tailwind base',
          '@tailwind components',
        ]);
        hasBasicSetup = tailwindConfig && hasDirectives;

        if (tailwindConfig) foundFiles.push('tailwind.config.js');
        if (!hasDirectives) recommendations.push('Add Tailwind directives to your CSS file');
        break;
      }

      case 'next-auth':
      case '@auth/nextjs':
        hasBasicSetup = await this.checkForPattern([
          '[...nextauth]',
          'auth.ts',
          'signIn',
          'signOut',
        ]);
        if (!hasBasicSetup) {
          recommendations.push('Set up authentication API route');
          recommendations.push('Configure auth providers');
        }
        break;

      default:
        // Generic check for imports/usage
        hasBasicSetup = await this.checkForPattern([
          packageName,
          packageName.split('/').pop() || '',
        ]);
    }

    let status: 'complete' | 'partial' | 'misconfigured' = 'partial';
    if (hasBasicSetup && hasAdvancedSetup) {
      status = 'complete';
    } else if (hasBasicSetup) {
      status = 'partial';
    } else {
      status = 'misconfigured';
      recommendations.unshift(`${packageName} is installed but not properly configured`);
    }

    return { status, foundFiles, recommendations };
  }

  private async checkForPattern(patterns: string[]): Promise<boolean> {
    try {
      const files = await glob('**/*.{js,jsx,ts,tsx,css,scss}', {
        cwd: this.config.projectRoot,
        ignore: ['node_modules/**', '.next/**', 'dist/**'],
        absolute: true,
      });

      for (const file of files.slice(0, 100)) {
        // Limit for performance
        try {
          const content = await fs.readFile(file, 'utf-8');
          if (patterns.some((pattern) => content.includes(pattern))) {
            return true;
          }
        } catch {
          // Skip files that can't be read
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private async checkFileExists(fileName: string): Promise<boolean> {
    return await fs.pathExists(path.join(this.config.projectRoot, fileName));
  }

  private async detectSetupIssues(): Promise<SetupIssue[]> {
    const issues: SetupIssue[] = [];

    // SEO Issues
    issues.push(...(await this.detectSEOIssues()));

    // Performance Issues
    issues.push(...(await this.detectPerformanceIssues()));

    // Accessibility Issues
    issues.push(...(await this.detectAccessibilityIssues()));

    // Structure Issues
    issues.push(...(await this.detectStructureIssues()));

    return issues;
  }

  private async detectSEOIssues(): Promise<SetupIssue[]> {
    const issues: SetupIssue[] = [];

    // Check for missing metadata
    if (this.projectStructure.hasAppDir) {
      const hasMetadata = await this.checkForPattern([
        'metadata',
        'generateMetadata',
        'title:',
        'description:',
      ]);
      if (!hasMetadata) {
        issues.push({
          category: 'seo',
          severity: 'warning',
          title: 'Missing Metadata Configuration',
          description: 'No metadata configuration found. This affects SEO and social sharing.',
          files: [],
          recommendations: [
            'Add metadata export to your layout.tsx files',
            'Use generateMetadata for dynamic pages',
            'Include title, description, and Open Graph tags',
          ],
        });
      }
    }

    // Check for missing sitemap
    const hasSitemap =
      (await this.checkFileExists('app/sitemap.ts')) ||
      (await this.checkFileExists('app/sitemap.js')) ||
      (await this.checkFileExists('public/sitemap.xml'));

    if (!hasSitemap) {
      issues.push({
        category: 'seo',
        severity: 'info',
        title: 'Missing Sitemap',
        description: 'No sitemap found. This helps search engines index your site.',
        files: [],
        recommendations: [
          'Add app/sitemap.ts for dynamic sitemap generation',
          'Or add a static sitemap.xml to your public directory',
        ],
      });
    }

    return issues;
  }

  private async detectPerformanceIssues(): Promise<SetupIssue[]> {
    const issues: SetupIssue[] = [];

    // Check for missing next/image usage
    const hasNextImage = await this.checkForPattern(['next/image', 'Image from']);
    const hasImgTags = await this.checkForPattern(['<img']);

    if (!hasNextImage && hasImgTags) {
      issues.push({
        category: 'performance',
        severity: 'warning',
        title: 'Consider Using next/image',
        description:
          'Found <img> tags but no next/image usage. Next.js Image component provides automatic optimization.',
        files: [],
        recommendations: [
          'Replace <img> tags with next/image Image component',
          'Benefits include automatic optimization, lazy loading, and WebP conversion',
        ],
      });
    }

    // Check for missing loading states
    if (this.projectStructure.hasAppDir) {
      const hasLoadingFiles = await glob('**/loading.{js,jsx,ts,tsx}', {
        cwd: this.config.projectRoot,
      });

      if (hasLoadingFiles.length === 0) {
        issues.push({
          category: 'performance',
          severity: 'info',
          title: 'Missing Loading UI',
          description: 'No loading.tsx files found. These improve perceived performance.',
          files: [],
          recommendations: [
            'Add loading.tsx files for routes with data fetching',
            'Consider skeleton screens for better UX',
          ],
        });
      }
    }

    return issues;
  }

  private async detectAccessibilityIssues(): Promise<SetupIssue[]> {
    const issues: SetupIssue[] = [];

    // Check for missing alt attributes (basic check)
    const hasImages = await this.checkForPattern(['<img', '<Image']);
    const hasAltAttributes = await this.checkForPattern(['alt=', 'alt:', 'alt {']);

    if (hasImages && !hasAltAttributes) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: 'Missing Alt Attributes',
        description:
          'Images found without alt attributes. This affects screen reader accessibility.',
        files: [],
        recommendations: [
          'Add alt attributes to all images',
          'Use descriptive alt text for meaningful images',
          'Use empty alt="" for decorative images',
        ],
      });
    }

    return issues;
  }

  private async detectStructureIssues(): Promise<SetupIssue[]> {
    const issues: SetupIssue[] = [];

    // Check for missing error boundaries
    if (this.projectStructure.hasAppDir) {
      const hasErrorFiles = await glob('**/error.{js,jsx,ts,tsx}', {
        cwd: this.config.projectRoot,
      });

      if (hasErrorFiles.length === 0) {
        issues.push({
          category: 'structure',
          severity: 'warning',
          title: 'Missing Error Boundaries',
          description: 'No error.tsx files found. These provide better error handling and UX.',
          files: [],
          recommendations: [
            'Add error.tsx files for graceful error handling',
            'Consider a global-error.tsx for the root layout',
          ],
        });
      }
    }

    // Check for environment variables setup
    const hasEnvExample =
      (await this.checkFileExists('.env.example')) ||
      (await this.checkFileExists('.env.local.example'));
    const hasEnvLocal = await this.checkFileExists('.env.local');

    if (hasEnvLocal && !hasEnvExample) {
      issues.push({
        category: 'structure',
        severity: 'info',
        title: 'Missing Environment Variables Example',
        description: 'Environment variables found but no .env.example file for documentation.',
        files: ['.env.local'],
        recommendations: [
          'Create .env.example with placeholder values',
          'Document required environment variables',
          'Add .env.example to version control',
        ],
      });
    }

    return issues;
  }

  private calculateProjectHealth(
    patterns: NextJSPattern[],
    packages: CommonPackage[],
    setupIssues: SetupIssue[]
  ): { score: number; strengths: string[]; improvements: string[] } {
    let score = 100;
    const strengths: string[] = [];
    const improvements: string[] = [];

    // Advanced patterns usage (bonus points)
    const advancedPatterns = patterns.filter((p) =>
      ['route-group', 'private-folder', 'intercepting-route', 'parallel-route'].includes(p.type)
    );
    if (advancedPatterns.length > 0) {
      strengths.push(`Using ${advancedPatterns.length} advanced Next.js routing patterns`);
    }

    // Package setup scoring
    const installedPackages = packages.filter((p) => p.installed);
    const wellConfiguredPackages = packages.filter((p) => p.setupStatus === 'complete');

    if (installedPackages.length > 0) {
      strengths.push(`${installedPackages.length} Next.js ecosystem packages installed`);
    }

    if (wellConfiguredPackages.length < installedPackages.length) {
      score -= (installedPackages.length - wellConfiguredPackages.length) * 5;
      improvements.push('Some packages need better configuration');
    }

    // Setup issues scoring
    const errorIssues = setupIssues.filter((i) => i.severity === 'error');
    const warningIssues = setupIssues.filter((i) => i.severity === 'warning');

    score -= errorIssues.length * 15;
    score -= warningIssues.length * 10;

    if (errorIssues.length === 0) {
      strengths.push('No critical setup issues found');
    } else {
      improvements.push(`${errorIssues.length} critical issues need attention`);
    }

    if (warningIssues.length > 0) {
      improvements.push(`${warningIssues.length} optimization opportunities identified`);
    }

    // Router type bonus
    if (this.projectStructure.routerType === 'app') {
      strengths.push('Using modern App Router');
    } else if (this.projectStructure.routerType === 'hybrid') {
      strengths.push('Gradual migration to App Router detected');
    }

    score = Math.max(0, Math.min(100, score));

    return { score, strengths, improvements };
  }
}
