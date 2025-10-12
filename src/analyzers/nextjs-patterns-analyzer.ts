import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'fast-glob';
import { tSync } from '../i18n/utils/i18n';
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

export interface AccessibilityIssues {
  missingAltText: Set<string>;
  missingHeadingStructure: Set<string>;
  missingAriaLabels: Set<string>;
  lowContrastColors: Set<string>;
  missingSkipLinks: Set<string>;
  improperHeadingOrder: Set<string>;
  missingLandmarks: Set<string>;
  inaccessibleForms: Set<string>;
  missingFocusIndicators: Set<string>;
  autoplayMedia: Set<string>;
  insufficientColorContrast: Set<string>;
  missingLanguageAttributes: Set<string>;
  inaccessibleLinks: Set<string>;
  missingButtonLabels: Set<string>;
  improperTableStructure: Set<string>;
  missingLiveRegions: Set<string>;
  keyboardNavigation: Set<string>;
  missingPageTitles: Set<string>;
  dragDropWithoutAlternatives: Set<string>;
  authenticationComplexity: Set<string>;
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
          // Store the content for potential analysis
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

    try {
      // Get all component files for detailed analysis
      const componentFiles = await glob('**/*.{jsx,tsx}', {
        cwd: this.config.projectRoot,
        ignore: ['node_modules/**', '.next/**', 'dist/**', 'out/**'],
        absolute: true,
      });

      // Track found issues across files
      const foundIssues = {
        missingAltText: new Set<string>(),
        missingHeadingStructure: new Set<string>(),
        missingAriaLabels: new Set<string>(),
        lowContrastColors: new Set<string>(),
        missingSkipLinks: new Set<string>(),
        improperHeadingOrder: new Set<string>(),
        missingLandmarks: new Set<string>(),
        inaccessibleForms: new Set<string>(),
        missingFocusIndicators: new Set<string>(),
        autoplayMedia: new Set<string>(),
        insufficientColorContrast: new Set<string>(),
        missingLanguageAttributes: new Set<string>(),
        inaccessibleLinks: new Set<string>(),
        missingButtonLabels: new Set<string>(),
        improperTableStructure: new Set<string>(),
        missingLiveRegions: new Set<string>(),
        keyboardNavigation: new Set<string>(),
        missingPageTitles: new Set<string>(),
        dragDropWithoutAlternatives: new Set<string>(),
        authenticationComplexity: new Set<string>(),
      };

      // Analyze each component file
      for (const file of componentFiles.slice(0, 200)) {
        // Limit for performance
        try {
          const content = await fs.readFile(file, 'utf-8');
          const relativePath = path.relative(this.config.projectRoot, file);

          await this.analyzeFileForAccessibilityIssues(content, relativePath, foundIssues);
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      // Check for Next.js specific accessibility patterns
      await this.checkNextJSAccessibilityPatterns(foundIssues);

      // Generate issues based on findings
      issues.push(...this.generateAccessibilityIssues(foundIssues));

      // Check for global accessibility setup
      issues.push(...(await this.checkGlobalAccessibilitySetup()));
    } catch (error) {
      console.warn('Error analyzing accessibility:', error);
    }

    return issues;
  }

  private async analyzeFileForAccessibilityIssues(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): Promise<void> {
    // WCAG 2.2 Success Criterion 1.1.1: Non-text Content
    this.checkForMissingAltText(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 1.3.1: Info and Relationships
    this.checkHeadingStructure(content, filePath, foundIssues);
    this.checkFormLabels(content, filePath, foundIssues);
    this.checkTableStructure(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 1.3.4: Orientation
    this.checkOrientationSupport(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 1.3.5: Identify Input Purpose
    this.checkInputPurpose(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 1.4.1: Use of Color
    this.checkColorUsage(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 1.4.3: Contrast (Minimum)
    this.checkContrastIssues(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 1.4.10: Reflow
    this.checkReflowSupport(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 1.4.11: Non-text Contrast
    this.checkNonTextContrast(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 1.4.12: Text Spacing
    this.checkTextSpacing(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 1.4.13: Content on Hover or Focus
    this.checkHoverFocusContent(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.1.1: Keyboard
    this.checkKeyboardAccessibility(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.1.4: Character Key Shortcuts
    this.checkCharacterKeyShortcuts(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.2.2: Pause, Stop, Hide
    this.checkAutoplayMedia(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.4.1: Bypass Blocks
    this.checkSkipLinks(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.4.2: Page Titled
    this.checkPageTitles(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.4.3: Focus Order
    this.checkFocusOrder(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.4.4: Link Purpose (In Context)
    this.checkLinkPurpose(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.4.6: Headings and Labels
    this.checkHeadingsAndLabels(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.4.7: Focus Visible
    this.checkFocusVisible(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.4.11: Focus Not Obscured (Minimum) - NEW in 2.2
    this.checkFocusNotObscured(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.5.1: Pointer Gestures
    this.checkPointerGestures(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.5.2: Pointer Cancellation
    this.checkPointerCancellation(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.5.3: Label in Name
    this.checkLabelInName(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.5.4: Motion Actuation
    this.checkMotionActuation(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.5.7: Dragging Movements - NEW in 2.2
    this.checkDraggingMovements(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 2.5.8: Target Size (Minimum) - NEW in 2.2
    this.checkTargetSize(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 3.1.1: Language of Page
    this.checkLanguageAttributes(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 3.2.6: Consistent Help - NEW in 2.2
    this.checkConsistentHelp(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 3.3.7: Redundant Entry - NEW in 2.2
    this.checkRedundantEntry(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 3.3.8: Accessible Authentication (Minimum) - NEW in 2.2
    this.checkAccessibleAuthentication(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 4.1.2: Name, Role, Value
    this.checkNameRoleValue(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 4.1.2: Button Labels
    this.checkButtonLabels(content, filePath, foundIssues);

    // WCAG 2.2 Success Criterion 4.1.3: Status Messages
    this.checkStatusMessages(content, filePath, foundIssues);
  }

  // WCAG 2.2 Success Criterion 1.1.1: Non-text Content
  private checkForMissingAltText(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for Next.js Image components without alt
    const nextImagePattern = /<Image[^>]*(?!.*alt=)[^>]*\/?>/gi;
    const htmlImgPattern = /<img[^>]*(?!.*alt=)[^>]*\/?>/gi;

    if (nextImagePattern.test(content) || htmlImgPattern.test(content)) {
      foundIssues.missingAltText.add(filePath);
    }

    // Check for empty alt attributes on decorative images
    const emptyAltPattern = /<(?:img|Image)[^>]*alt=["']\s*["'][^>]*>/gi;
    const decorativePattern = /\b(?:decorative|decoration|bg|background)\b/i;

    if (emptyAltPattern.test(content) && !decorativePattern.test(content)) {
      // This might be a misuse of empty alt
      foundIssues.missingAltText.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.3.1: Info and Relationships
  private checkHeadingStructure(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const headingPattern = /<h([1-6])[^>]*>/gi;
    const headings: number[] = [];
    let match: RegExpExecArray | null;

    match = headingPattern.exec(content);
    while (match !== null) {
      headings.push(parseInt(match[1], 10));
      match = headingPattern.exec(content);
    }

    // Check for proper heading hierarchy
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];

      // Heading levels should not skip (e.g., h1 -> h3)
      if (current > previous + 1) {
        foundIssues.improperHeadingOrder.add(filePath);
        break;
      }
    }

    // Check if h1 exists
    if (content.includes('<h2') && !content.includes('<h1')) {
      foundIssues.missingHeadingStructure.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.3.1: Form Labels
  private checkFormLabels(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for input elements without proper labels
    const inputPattern = /<input[^>]*type=["'](?!hidden)[^"']*["'][^>]*>/gi;
    const labelPattern =
      /<label[^>]*for=["'][^"']*["'][^>]*>|aria-label=["'][^"']*["']|aria-labelledby=["'][^"']*["']/gi;

    const inputs = content.match(inputPattern) || [];
    const labels = content.match(labelPattern) || [];

    if (inputs.length > labels.length) {
      foundIssues.inaccessibleForms.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.3.1: Table Structure
  private checkTableStructure(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    if (content.includes('<table')) {
      const hasTableHeaders = content.includes('<th') || content.includes('scope=');
      const hasCaptionOrSummary = content.includes('<caption') || content.includes('summary=');

      if (!hasTableHeaders && !hasCaptionOrSummary) {
        foundIssues.improperTableStructure.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 1.3.4: Orientation
  private checkOrientationSupport(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for orientation locks in CSS or viewport meta
    if (content.includes('orientation:') || content.includes('user-scalable=no')) {
      foundIssues.keyboardNavigation.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.3.5: Identify Input Purpose
  private checkInputPurpose(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const inputPattern = /<input[^>]*type=["'](?:email|tel|url|password|text)["'][^>]*>/gi;
    const autocompletePattern = /autocomplete=["'][^"']*["']/gi;

    const inputs = content.match(inputPattern) || [];
    const autocompleteCounts = (content.match(autocompletePattern) || []).length;

    if (inputs.length > autocompleteCounts) {
      foundIssues.inaccessibleForms.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.4.1: Use of Color
  private checkColorUsage(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Look for color-only indicators
    const colorOnlyPatterns = [
      /color:\s*red[^;]*;[^}]*(?!(?:border|background|text))/gi,
      /class=["'][^"']*(?:red|green|blue|yellow)[^"']*["'](?![^>]*(?:icon|img))/gi,
    ];

    if (colorOnlyPatterns.some((pattern) => pattern.test(content))) {
      foundIssues.insufficientColorContrast.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.4.3: Contrast (Minimum)
  private checkContrastIssues(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Basic check for potentially problematic color combinations
    const problematicPatterns = [
      /color:\s*#?(?:fff|ffffff|white)[^;]*;[^}]*background[^:]*:#?(?:fff|ffffff|white)/gi,
      /color:\s*#?(?:000|000000|black)[^;]*;[^}]*background[^:]*:#?(?:000|000000|black)/gi,
      /text-(?:gray|grey)-[12]00/gi, // Very light text colors in Tailwind
    ];

    if (problematicPatterns.some((pattern) => pattern.test(content))) {
      foundIssues.lowContrastColors.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.4.10: Reflow
  private checkReflowSupport(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for fixed widths that might prevent reflow
    const fixedWidthPattern = /(?:width|min-width):\s*(?:\d+px|\d+pt|\d+cm)/gi;
    const overflowHiddenPattern = /overflow:\s*hidden/gi;

    if (fixedWidthPattern.test(content) && overflowHiddenPattern.test(content)) {
      foundIssues.insufficientColorContrast.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.4.11: Non-text Contrast
  private checkNonTextContrast(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for UI components that might have insufficient contrast
    const uiComponentPattern = /<(?:button|input|select|textarea)[^>]*>/gi;
    const borderPattern = /border[^:]*:\s*(?:1px|thin|none)/gi;

    if (uiComponentPattern.test(content) && borderPattern.test(content)) {
      foundIssues.missingFocusIndicators.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.4.12: Text Spacing
  private checkTextSpacing(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for CSS that might prevent text spacing adjustments
    const spacingRestrictions = [
      /line-height:\s*(?:1|1\.0|100%)/gi,
      /letter-spacing:\s*0/gi,
      /word-spacing:\s*0/gi,
    ];

    if (spacingRestrictions.some((pattern) => pattern.test(content))) {
      foundIssues.insufficientColorContrast.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 1.4.13: Content on Hover or Focus
  private checkHoverFocusContent(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const hoverPattern = /:hover/gi;
    const focusPattern = /:focus/gi;
    const tooltipPattern = /tooltip|popover|dropdown/gi;

    if (
      (hoverPattern.test(content) || focusPattern.test(content)) &&
      tooltipPattern.test(content)
    ) {
      // Should have escape mechanism and persistent content
      if (!content.includes('onKeyDown') && !content.includes('onEscape')) {
        foundIssues.keyboardNavigation.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.1.1: Keyboard
  private checkKeyboardAccessibility(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for click handlers without keyboard equivalents
    const clickHandlerPattern = /onClick[^=]*=/gi;
    const keyboardHandlerPattern = /(?:onKeyDown|onKeyPress|onKeyUp)[^=]*=/gi;

    const clickHandlers = (content.match(clickHandlerPattern) || []).length;
    const keyboardHandlers = (content.match(keyboardHandlerPattern) || []).length;

    if (clickHandlers > 0 && keyboardHandlers === 0) {
      foundIssues.keyboardNavigation.add(filePath);
    }

    // Check for custom interactive elements without proper roles
    const divClickPattern = /<div[^>]*onClick[^>]*>/gi;
    const spanClickPattern = /<span[^>]*onClick[^>]*>/gi;

    if (divClickPattern.test(content) || spanClickPattern.test(content)) {
      if (!content.includes('role="button"') && !content.includes('tabIndex')) {
        foundIssues.keyboardNavigation.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.1.4: Character Key Shortcuts
  private checkCharacterKeyShortcuts(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const shortcutPattern = /(?:key|shortcut)[^=]*=[^>]*["'][a-z]["']/gi;

    if (shortcutPattern.test(content)) {
      // Should have mechanism to turn off or remap
      if (!content.includes('disable') && !content.includes('remap')) {
        foundIssues.keyboardNavigation.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.2.2: Pause, Stop, Hide
  private checkAutoplayMedia(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const autoplayPattern = /<(?:video|audio)[^>]*autoplay[^>]*>/gi;
    const autoplayControlsPattern =
      /<(?:video|audio)[^>]*(?:autoplay[^>]*controls|controls[^>]*autoplay)[^>]*>/gi;

    if (autoplayPattern.test(content) && !autoplayControlsPattern.test(content)) {
      foundIssues.autoplayMedia.add(filePath);
    }

    // Check for auto-advancing carousels
    const carouselPattern = /(?:carousel|slider|swiper)/gi;
    const autoAdvancePattern = /(?:autoplay|auto|interval)/gi;

    if (carouselPattern.test(content) && autoAdvancePattern.test(content)) {
      if (!content.includes('pause') && !content.includes('stop')) {
        foundIssues.autoplayMedia.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.4.1: Bypass Blocks
  private checkSkipLinks(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for skip links in main layout files
    if (filePath.includes('layout') || filePath.includes('_app') || filePath.includes('root')) {
      const skipLinkPattern = /(?:skip|jump)[^>]*(?:main|content|navigation)/gi;

      if (!skipLinkPattern.test(content)) {
        foundIssues.missingSkipLinks.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.4.2: Page Titled
  private checkPageTitles(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for Next.js Head or metadata
    if (filePath.includes('page') || filePath.includes('layout')) {
      const titlePattern = /<title[^>]*>|metadata[^=]*title|generateMetadata/gi;

      if (!titlePattern.test(content)) {
        foundIssues.missingPageTitles.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.4.3: Focus Order
  private checkFocusOrder(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const positiveTabIndex = /tabIndex[^=]*=[^>]*["'][1-9]\d*["']/gi;

    if (positiveTabIndex.test(content)) {
      foundIssues.keyboardNavigation.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 2.4.4: Link Purpose (In Context)
  private checkLinkPurpose(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for vague link text
    const vagueLinkPattern =
      /<(?:a|Link)[^>]*>\s*(?:click here|here|more|read more|continue|learn more)\s*<\/(?:a|Link)>/gi;

    if (vagueLinkPattern.test(content)) {
      foundIssues.inaccessibleLinks.add(filePath);
    }

    // Check for links without accessible names
    const linkPattern = /<(?:a|Link)[^>]*href[^>]*>(?!.*aria-label)(?!.*title)\s*<\/(?:a|Link)>/gi;

    if (linkPattern.test(content)) {
      foundIssues.inaccessibleLinks.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 2.4.6: Headings and Labels
  private checkHeadingsAndLabels(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for empty headings
    const emptyHeadingPattern = /<h[1-6][^>]*>\s*<\/h[1-6]>/gi;

    if (emptyHeadingPattern.test(content)) {
      foundIssues.missingHeadingStructure.add(filePath);
    }

    // Check for non-descriptive labels
    const genericLabelPattern = /<label[^>]*>\s*(?:field|input|text|label)\s*<\/label>/gi;

    if (genericLabelPattern.test(content)) {
      foundIssues.inaccessibleForms.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 2.4.7: Focus Visible
  private checkFocusVisible(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for focus outline removal without replacement
    const outlineNonePattern = /outline:\s*(?:none|0)/gi;
    const focusVisiblePattern = /:focus-visible|:focus/gi;

    if (outlineNonePattern.test(content) && !focusVisiblePattern.test(content)) {
      foundIssues.missingFocusIndicators.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 2.4.11: Focus Not Obscured (Minimum) - NEW in 2.2
  private checkFocusNotObscured(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for sticky/fixed elements that might obscure focus
    const stickyPattern = /(?:position:\s*(?:sticky|fixed)|class=["'][^"']*(?:sticky|fixed))/gi;
    const zIndexPattern = /z-index:\s*\d+/gi;

    if (stickyPattern.test(content) && zIndexPattern.test(content)) {
      // Should have focus management consideration
      if (!content.includes('focus') && !content.includes('scroll')) {
        foundIssues.missingFocusIndicators.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.5.1: Pointer Gestures
  private checkPointerGestures(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const gesturePattern = /(?:swipe|pinch|twist|multipoint)/gi;

    if (gesturePattern.test(content)) {
      // Should have single-pointer alternative
      if (!content.includes('button') && !content.includes('click')) {
        foundIssues.keyboardNavigation.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.5.2: Pointer Cancellation
  private checkPointerCancellation(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const downEventPattern = /(?:onMouseDown|onPointerDown|onTouchStart)/gi;
    const upEventPattern = /(?:onMouseUp|onPointerUp|onTouchEnd|onClick)/gi;

    if (downEventPattern.test(content) && !upEventPattern.test(content)) {
      foundIssues.keyboardNavigation.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 2.5.3: Label in Name
  private checkLabelInName(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for mismatched visible and accessible names
    const ariaLabelPattern = /aria-label=["']([^"']*)["']/gi;
    let match: RegExpExecArray | null;

    match = ariaLabelPattern.exec(content);
    while (match !== null) {
      const ariaLabel = match[1].toLowerCase();
      // This is a simplified check - in practice, would need more sophisticated parsing
      if (!content.toLowerCase().includes(ariaLabel.substring(0, 10))) {
        foundIssues.missingAriaLabels.add(filePath);
        break;
      }
      match = ariaLabelPattern.exec(content);
    }
  }

  // WCAG 2.2 Success Criterion 2.5.4: Motion Actuation
  private checkMotionActuation(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const motionPattern = /(?:devicemotion|deviceorientation|shake|tilt)/gi;

    if (motionPattern.test(content)) {
      // Should have alternative input method
      if (!content.includes('button') && !content.includes('toggle')) {
        foundIssues.keyboardNavigation.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.5.7: Dragging Movements - NEW in 2.2
  private checkDraggingMovements(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const dragPattern = /(?:drag|drop|sortable|draggable)/gi;

    if (dragPattern.test(content)) {
      // Should have single pointer alternative
      const alternativePattern = /(?:button|arrow|move|reorder)/gi;

      if (!alternativePattern.test(content)) {
        foundIssues.dragDropWithoutAlternatives.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 2.5.8: Target Size (Minimum) - NEW in 2.2
  private checkTargetSize(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for very small interactive targets
    const smallTargetPattern =
      /(?:width|height|min-width|min-height):\s*(?:[1-9]|1[0-9]|2[0-3])px/gi;
    const interactivePattern = /<(?:button|a|input|select|textarea)[^>]*>/gi;

    if (smallTargetPattern.test(content) && interactivePattern.test(content)) {
      foundIssues.keyboardNavigation.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 3.1.1: Language of Page
  private checkLanguageAttributes(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    if (filePath.includes('layout') || filePath.includes('_app') || filePath.includes('root')) {
      if (!content.includes('lang=') && !content.includes('locale')) {
        foundIssues.missingLanguageAttributes.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 3.2.6: Consistent Help - NEW in 2.2
  private checkConsistentHelp(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const helpPattern = /(?:help|support|contact|faq)/gi;

    if (helpPattern.test(content)) {
      // Help should be consistently located
      if (!content.includes('nav') && !content.includes('header') && !content.includes('footer')) {
        foundIssues.missingLandmarks.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 3.3.7: Redundant Entry - NEW in 2.2
  private checkRedundantEntry(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const formPattern = /<form[^>]*>/gi;
    const autocompletePattern = /autocomplete=["'][^"']*["']/gi;

    if (formPattern.test(content)) {
      const forms = (content.match(formPattern) || []).length;
      const autocompleteCounts = (content.match(autocompletePattern) || []).length;

      if (forms > autocompleteCounts) {
        foundIssues.inaccessibleForms.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 3.3.8: Accessible Authentication (Minimum) - NEW in 2.2
  private checkAccessibleAuthentication(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const authPattern = /(?:password|login|signin|authentication|auth)/gi;
    const captchaPattern = /(?:captcha|recaptcha)/gi;

    if (authPattern.test(content) && captchaPattern.test(content)) {
      // CAPTCHA should have alternative
      if (!content.includes('audio') && !content.includes('alternative')) {
        foundIssues.authenticationComplexity.add(filePath);
      }
    }

    // Check for complex authentication requirements
    const complexAuthPattern = /(?:remember|memorize|transcribe|type)/gi;

    if (authPattern.test(content) && complexAuthPattern.test(content)) {
      if (!content.includes('autocomplete') && !content.includes('paste')) {
        foundIssues.authenticationComplexity.add(filePath);
      }
    }
  }

  // WCAG 2.2 Success Criterion 4.1.2: Name, Role, Value
  private checkNameRoleValue(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for custom controls without proper ARIA
    const customControlPattern = /<div[^>]*(?:onClick|role)[^>]*>/gi;
    const ariaPattern = /(?:aria-label|aria-labelledby|aria-describedby|role)/gi;

    const customControls = (content.match(customControlPattern) || []).length;
    const ariaAttributes = (content.match(ariaPattern) || []).length;

    if (customControls > 0 && ariaAttributes < customControls) {
      foundIssues.missingAriaLabels.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 4.1.2: Button Labels
  private checkButtonLabels(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    // Check for buttons without accessible labels
    const buttonPattern = /<button[^>]*>/gi;
    const labeledButtonPattern = /<button[^>]*(?:aria-label|title)[^>]*>|<button[^>]*>[^<]+</gi;

    const buttons = (content.match(buttonPattern) || []).length;
    const labeledButtons = (content.match(labeledButtonPattern) || []).length;

    if (buttons > labeledButtons) {
      foundIssues.missingButtonLabels.add(filePath);
    }

    // Check for icon-only buttons without labels
    const iconButtonPattern =
      /<button[^>]*>[\s]*<(?:svg|i|span)[^>]*(?:icon|fa-)[^>]*>[^<]*<\/(?:svg|i|span)>[\s]*<\/button>/gi;
    const iconButtonsWithLabel =
      /<button[^>]*aria-label[^>]*>[\s]*<(?:svg|i|span)[^>]*(?:icon|fa-)[^>]*>/gi;

    if (iconButtonPattern.test(content) && !iconButtonsWithLabel.test(content)) {
      foundIssues.missingButtonLabels.add(filePath);
    }
  }

  // WCAG 2.2 Success Criterion 4.1.3: Status Messages
  private checkStatusMessages(
    content: string,
    filePath: string,
    foundIssues: AccessibilityIssues
  ): void {
    const statusPattern = /(?:success|error|warning|info|alert|notification|toast)/gi;
    const liveRegionPattern = /(?:aria-live|role=["'](?:alert|status|log)["'])/gi;

    if (statusPattern.test(content) && !liveRegionPattern.test(content)) {
      foundIssues.missingLiveRegions.add(filePath);
    }
  }

  private async checkNextJSAccessibilityPatterns(foundIssues: AccessibilityIssues): Promise<void> {
    // Check for Next.js specific accessibility patterns

    // Check for proper Next/Head usage for page titles
    const hasNextHead = await this.checkForPattern(['next/head', 'Head from']);
    const hasMetadata = await this.checkForPattern(['metadata', 'generateMetadata']);

    if (!hasNextHead && !hasMetadata) {
      foundIssues.missingPageTitles.add('Missing Next.js Head or metadata configuration');
    }

    // Check for Next/Image usage vs regular img tags
    const hasNextImage = await this.checkForPattern(['next/image', 'Image from']);
    const hasImgTags = await this.checkForPattern(['<img']);

    if (hasImgTags && !hasNextImage) {
      foundIssues.missingAltText.add(
        'Consider using Next.js Image component for better accessibility'
      );
    }

    // Check for Next/Link usage for client-side navigation
    const hasNextLink = await this.checkForPattern(['next/link', 'Link from']);
    const hasAnchorTags = await this.checkForPattern(['<a href']);

    if (hasAnchorTags && !hasNextLink) {
      foundIssues.inaccessibleLinks.add(
        'Consider using Next.js Link component for better navigation'
      );
    }
  }

  private generateAccessibilityIssues(foundIssues: AccessibilityIssues): SetupIssue[] {
    const issues: SetupIssue[] = [];

    if (foundIssues.missingAltText.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.missingAltText.title'),
        description: tSync('cli.accessibility.issues.missingAltText.description'),
        files: Array.from(foundIssues.missingAltText),
        recommendations: [
          tSync('cli.accessibility.issues.missingAltText.recommendations.0'),
          tSync('cli.accessibility.issues.missingAltText.recommendations.1'),
          tSync('cli.accessibility.issues.missingAltText.recommendations.2'),
          tSync('cli.accessibility.issues.missingAltText.recommendations.3'),
          tSync('cli.accessibility.issues.missingAltText.recommendations.4'),
        ],
      });
    }

    if (foundIssues.improperHeadingOrder.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.improperHeadingOrder.title'),
        description: tSync('cli.accessibility.issues.improperHeadingOrder.description'),
        files: Array.from(foundIssues.improperHeadingOrder),
        recommendations: [
          tSync('cli.accessibility.issues.improperHeadingOrder.recommendations.0'),
          tSync('cli.accessibility.issues.improperHeadingOrder.recommendations.1'),
          tSync('cli.accessibility.issues.improperHeadingOrder.recommendations.2'),
          tSync('cli.accessibility.issues.improperHeadingOrder.recommendations.3'),
          tSync('cli.accessibility.issues.improperHeadingOrder.recommendations.4'),
        ],
      });
    }

    if (foundIssues.missingHeadingStructure.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.missingHeadingStructure.title'),
        description: tSync('cli.accessibility.issues.missingHeadingStructure.description'),
        files: Array.from(foundIssues.missingHeadingStructure),
        recommendations: [
          tSync('cli.accessibility.issues.missingHeadingStructure.recommendations.0'),
          tSync('cli.accessibility.issues.missingHeadingStructure.recommendations.1'),
          tSync('cli.accessibility.issues.missingHeadingStructure.recommendations.2'),
          tSync('cli.accessibility.issues.missingHeadingStructure.recommendations.3'),
        ],
      });
    }

    if (foundIssues.inaccessibleForms.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.inaccessibleForms.title'),
        description: tSync('cli.accessibility.issues.inaccessibleForms.description'),
        files: Array.from(foundIssues.inaccessibleForms),
        recommendations: [
          tSync('cli.accessibility.issues.inaccessibleForms.recommendations.0'),
          tSync('cli.accessibility.issues.inaccessibleForms.recommendations.1'),
          tSync('cli.accessibility.issues.inaccessibleForms.recommendations.2'),
          tSync('cli.accessibility.issues.inaccessibleForms.recommendations.3'),
          tSync('cli.accessibility.issues.inaccessibleForms.recommendations.4'),
          tSync('cli.accessibility.issues.inaccessibleForms.recommendations.5'),
        ],
      });
    }

    if (foundIssues.keyboardNavigation.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.keyboardNavigation.title'),
        description: tSync('cli.accessibility.issues.keyboardNavigation.description'),
        files: Array.from(foundIssues.keyboardNavigation),
        recommendations: [
          tSync('cli.accessibility.issues.keyboardNavigation.recommendations.0'),
          tSync('cli.accessibility.issues.keyboardNavigation.recommendations.1'),
          tSync('cli.accessibility.issues.keyboardNavigation.recommendations.2'),
          tSync('cli.accessibility.issues.keyboardNavigation.recommendations.3'),
          tSync('cli.accessibility.issues.keyboardNavigation.recommendations.4'),
          tSync('cli.accessibility.issues.keyboardNavigation.recommendations.5'),
          tSync('cli.accessibility.issues.keyboardNavigation.recommendations.6'),
        ],
      });
    }

    if (foundIssues.missingFocusIndicators.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.missingFocusIndicators.title'),
        description: tSync('cli.accessibility.issues.missingFocusIndicators.description'),
        files: Array.from(foundIssues.missingFocusIndicators),
        recommendations: [
          tSync('cli.accessibility.issues.missingFocusIndicators.recommendations.0'),
          tSync('cli.accessibility.issues.missingFocusIndicators.recommendations.1'),
          tSync('cli.accessibility.issues.missingFocusIndicators.recommendations.2'),
          tSync('cli.accessibility.issues.missingFocusIndicators.recommendations.3'),
          tSync('cli.accessibility.issues.missingFocusIndicators.recommendations.4'),
          tSync('cli.accessibility.issues.missingFocusIndicators.recommendations.5'),
        ],
      });
    }

    if (foundIssues.autoplayMedia.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.autoplayMedia.title'),
        description: tSync('cli.accessibility.issues.autoplayMedia.description'),
        files: Array.from(foundIssues.autoplayMedia),
        recommendations: [
          tSync('cli.accessibility.issues.autoplayMedia.recommendations.0'),
          tSync('cli.accessibility.issues.autoplayMedia.recommendations.1'),
          tSync('cli.accessibility.issues.autoplayMedia.recommendations.2'),
          tSync('cli.accessibility.issues.autoplayMedia.recommendations.3'),
          tSync('cli.accessibility.issues.autoplayMedia.recommendations.4'),
        ],
      });
    }

    if (foundIssues.missingSkipLinks.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.missingSkipLinks.title'),
        description: tSync('cli.accessibility.issues.missingSkipLinks.description'),
        files: Array.from(foundIssues.missingSkipLinks),
        recommendations: [
          tSync('cli.accessibility.issues.missingSkipLinks.recommendations.0'),
          tSync('cli.accessibility.issues.missingSkipLinks.recommendations.1'),
          tSync('cli.accessibility.issues.missingSkipLinks.recommendations.2'),
          tSync('cli.accessibility.issues.missingSkipLinks.recommendations.3'),
          tSync('cli.accessibility.issues.missingSkipLinks.recommendations.4'),
        ],
      });
    }

    if (foundIssues.missingPageTitles.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.missingPageTitles.title'),
        description: tSync('cli.accessibility.issues.missingPageTitles.description'),
        files: Array.from(foundIssues.missingPageTitles),
        recommendations: [
          tSync('cli.accessibility.issues.missingPageTitles.recommendations.0'),
          tSync('cli.accessibility.issues.missingPageTitles.recommendations.1'),
          tSync('cli.accessibility.issues.missingPageTitles.recommendations.2'),
          tSync('cli.accessibility.issues.missingPageTitles.recommendations.3'),
          tSync('cli.accessibility.issues.missingPageTitles.recommendations.4'),
        ],
      });
    }

    if (foundIssues.inaccessibleLinks.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.inaccessibleLinks.title'),
        description: tSync('cli.accessibility.issues.inaccessibleLinks.description'),
        files: Array.from(foundIssues.inaccessibleLinks),
        recommendations: [
          tSync('cli.accessibility.issues.inaccessibleLinks.recommendations.0'),
          tSync('cli.accessibility.issues.inaccessibleLinks.recommendations.1'),
          tSync('cli.accessibility.issues.inaccessibleLinks.recommendations.2'),
          tSync('cli.accessibility.issues.inaccessibleLinks.recommendations.3'),
          tSync('cli.accessibility.issues.inaccessibleLinks.recommendations.4'),
        ],
      });
    }

    if (foundIssues.missingAriaLabels.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.missingAriaLabels.title'),
        description: tSync('cli.accessibility.issues.missingAriaLabels.description'),
        files: Array.from(foundIssues.missingAriaLabels),
        recommendations: [
          tSync('cli.accessibility.issues.missingAriaLabels.recommendations.0'),
          tSync('cli.accessibility.issues.missingAriaLabels.recommendations.1'),
          tSync('cli.accessibility.issues.missingAriaLabels.recommendations.2'),
          tSync('cli.accessibility.issues.missingAriaLabels.recommendations.3'),
          tSync('cli.accessibility.issues.missingAriaLabels.recommendations.4'),
        ],
      });
    }

    if (foundIssues.lowContrastColors.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.lowContrastColors.title'),
        description: tSync('cli.accessibility.issues.lowContrastColors.description'),
        files: Array.from(foundIssues.lowContrastColors),
        recommendations: [
          tSync('cli.accessibility.issues.lowContrastColors.recommendations.0'),
          tSync('cli.accessibility.issues.lowContrastColors.recommendations.1'),
          tSync('cli.accessibility.issues.lowContrastColors.recommendations.2'),
          tSync('cli.accessibility.issues.lowContrastColors.recommendations.3'),
          tSync('cli.accessibility.issues.lowContrastColors.recommendations.4'),
        ],
      });
    }

    if (foundIssues.missingLanguageAttributes.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.missingLanguageAttributes.title'),
        description: tSync('cli.accessibility.issues.missingLanguageAttributes.description'),
        files: Array.from(foundIssues.missingLanguageAttributes),
        recommendations: [
          tSync('cli.accessibility.issues.missingLanguageAttributes.recommendations.0'),
          tSync('cli.accessibility.issues.missingLanguageAttributes.recommendations.1'),
          tSync('cli.accessibility.issues.missingLanguageAttributes.recommendations.2'),
          tSync('cli.accessibility.issues.missingLanguageAttributes.recommendations.3'),
        ],
      });
    }

    if (foundIssues.missingLiveRegions.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.missingLiveRegions.title'),
        description: tSync('cli.accessibility.issues.missingLiveRegions.description'),
        files: Array.from(foundIssues.missingLiveRegions),
        recommendations: [
          tSync('cli.accessibility.issues.missingLiveRegions.recommendations.0'),
          tSync('cli.accessibility.issues.missingLiveRegions.recommendations.1'),
          tSync('cli.accessibility.issues.missingLiveRegions.recommendations.2'),
          tSync('cli.accessibility.issues.missingLiveRegions.recommendations.3'),
          tSync('cli.accessibility.issues.missingLiveRegions.recommendations.4'),
        ],
      });
    }

    if (foundIssues.dragDropWithoutAlternatives.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.dragDropWithoutAlternatives.title'),
        description: tSync('cli.accessibility.issues.dragDropWithoutAlternatives.description'),
        files: Array.from(foundIssues.dragDropWithoutAlternatives),
        recommendations: [
          tSync('cli.accessibility.issues.dragDropWithoutAlternatives.recommendations.0'),
          tSync('cli.accessibility.issues.dragDropWithoutAlternatives.recommendations.1'),
          tSync('cli.accessibility.issues.dragDropWithoutAlternatives.recommendations.2'),
          tSync('cli.accessibility.issues.dragDropWithoutAlternatives.recommendations.3'),
          tSync('cli.accessibility.issues.dragDropWithoutAlternatives.recommendations.4'),
        ],
      });
    }

    if (foundIssues.authenticationComplexity.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.authenticationComplexity.title'),
        description: tSync('cli.accessibility.issues.authenticationComplexity.description'),
        files: Array.from(foundIssues.authenticationComplexity),
        recommendations: [
          tSync('cli.accessibility.issues.authenticationComplexity.recommendations.0'),
          tSync('cli.accessibility.issues.authenticationComplexity.recommendations.1'),
          tSync('cli.accessibility.issues.authenticationComplexity.recommendations.2'),
          tSync('cli.accessibility.issues.authenticationComplexity.recommendations.3'),
          tSync('cli.accessibility.issues.authenticationComplexity.recommendations.4'),
          tSync('cli.accessibility.issues.authenticationComplexity.recommendations.5'),
        ],
      });
    }

    if (foundIssues.missingLandmarks.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.missingLandmarks.title'),
        description: tSync('cli.accessibility.issues.missingLandmarks.description'),
        files: Array.from(foundIssues.missingLandmarks),
        recommendations: [
          tSync('cli.accessibility.issues.missingLandmarks.recommendations.0'),
          tSync('cli.accessibility.issues.missingLandmarks.recommendations.1'),
          tSync('cli.accessibility.issues.missingLandmarks.recommendations.2'),
          tSync('cli.accessibility.issues.missingLandmarks.recommendations.3'),
          tSync('cli.accessibility.issues.missingLandmarks.recommendations.4'),
        ],
      });
    }

    if (foundIssues.insufficientColorContrast.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.insufficientColorContrast.title'),
        description: tSync('cli.accessibility.issues.insufficientColorContrast.description'),
        files: Array.from(foundIssues.insufficientColorContrast),
        recommendations: [
          tSync('cli.accessibility.issues.insufficientColorContrast.recommendations.0'),
          tSync('cli.accessibility.issues.insufficientColorContrast.recommendations.1'),
          tSync('cli.accessibility.issues.insufficientColorContrast.recommendations.2'),
          tSync('cli.accessibility.issues.insufficientColorContrast.recommendations.3'),
          tSync('cli.accessibility.issues.insufficientColorContrast.recommendations.4'),
        ],
      });
    }

    if (foundIssues.missingButtonLabels.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'error',
        title: tSync('cli.accessibility.issues.missingButtonLabels.title'),
        description: tSync('cli.accessibility.issues.missingButtonLabels.description'),
        files: Array.from(foundIssues.missingButtonLabels),
        recommendations: [
          tSync('cli.accessibility.issues.missingButtonLabels.recommendations.0'),
          tSync('cli.accessibility.issues.missingButtonLabels.recommendations.1'),
          tSync('cli.accessibility.issues.missingButtonLabels.recommendations.2'),
          tSync('cli.accessibility.issues.missingButtonLabels.recommendations.3'),
          tSync('cli.accessibility.issues.missingButtonLabels.recommendations.4'),
        ],
      });
    }

    if (foundIssues.improperTableStructure.size > 0) {
      issues.push({
        category: 'accessibility',
        severity: 'warning',
        title: tSync('cli.accessibility.issues.improperTableStructure.title'),
        description: tSync('cli.accessibility.issues.improperTableStructure.description'),
        files: Array.from(foundIssues.improperTableStructure),
        recommendations: [
          tSync('cli.accessibility.issues.improperTableStructure.recommendations.0'),
          tSync('cli.accessibility.issues.improperTableStructure.recommendations.1'),
          tSync('cli.accessibility.issues.improperTableStructure.recommendations.2'),
          tSync('cli.accessibility.issues.improperTableStructure.recommendations.3'),
          tSync('cli.accessibility.issues.improperTableStructure.recommendations.4'),
        ],
      });
    }

    return issues;
  }

  private async checkGlobalAccessibilitySetup(): Promise<SetupIssue[]> {
    const issues: SetupIssue[] = [];

    // Check for accessibility linting setup
    const packageJsonPath = path.join(this.config.projectRoot, 'package.json');

    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const hasAxeCore = 'axe-core' in allDeps || '@axe-core/react' in allDeps;
      const hasEslintA11y = 'eslint-plugin-jsx-a11y' in allDeps;

      if (!hasAxeCore && !hasEslintA11y) {
        issues.push({
          category: 'accessibility',
          severity: 'info',
          title: 'Missing Accessibility Tools',
          description:
            'No accessibility testing or linting tools detected in project dependencies.',
          files: ['package.json'],
          recommendations: [
            'Install eslint-plugin-jsx-a11y for accessibility linting',
            'Add @axe-core/react for runtime accessibility testing',
            'Include @testing-library/jest-dom for accessibility assertions',
            'Configure automated accessibility testing in CI/CD',
            'Consider using react-axe for development',
          ],
        });
      }

      // Check for internationalization setup
      const hasI18n =
        'next-i18next' in allDeps || 'react-intl' in allDeps || 'next-intl' in allDeps;

      if (!hasI18n) {
        issues.push({
          category: 'accessibility',
          severity: 'info',
          title: 'Missing Internationalization',
          description:
            'No internationalization setup detected, which is important for global accessibility.',
          files: ['package.json'],
          recommendations: [
            'Consider adding next-intl or react-intl for internationalization',
            'Set up proper language attributes and locale handling',
            'Plan for right-to-left (RTL) language support',
            'Configure date, number, and currency formatting',
          ],
        });
      }
    } catch {
      // Continue without package.json analysis
    }

    // Check for global CSS that might affect accessibility
    const globalCssFiles = await glob('**/*.{css,scss}', {
      cwd: this.config.projectRoot,
      ignore: ['node_modules/**', '.next/**'],
      absolute: true,
    });

    for (const cssFile of globalCssFiles.slice(0, 10)) {
      try {
        const content = await fs.readFile(cssFile, 'utf-8');

        // Check for global focus outline removal
        if (content.includes('outline: none') || content.includes('outline:none')) {
          issues.push({
            category: 'accessibility',
            severity: 'warning',
            title: 'Global Focus Outline Removal',
            description:
              'Global CSS removes focus outlines, which are essential for keyboard navigation.',
            files: [path.relative(this.config.projectRoot, cssFile)],
            recommendations: [
              'Provide alternative focus indicators when removing outlines',
              'Use :focus-visible for modern focus management',
              'Ensure focus indicators meet contrast requirements',
              'Test keyboard navigation thoroughly',
            ],
          });
        }

        // Check for accessibility-friendly CSS patterns
        const hasReducedMotion = content.includes('prefers-reduced-motion');
        const hasColorScheme = content.includes('prefers-color-scheme');

        if (
          !hasReducedMotion &&
          (content.includes('animation') || content.includes('transition'))
        ) {
          issues.push({
            category: 'accessibility',
            severity: 'info',
            title: 'Missing Motion Preferences',
            description: 'Animations detected without respecting user motion preferences.',
            files: [path.relative(this.config.projectRoot, cssFile)],
            recommendations: [
              'Use prefers-reduced-motion media query',
              'Provide options to disable animations',
              'Limit parallax and auto-playing effects',
              'Respect user system preferences',
            ],
          });
        }

        if (!hasColorScheme && content.includes('dark')) {
          issues.push({
            category: 'accessibility',
            severity: 'info',
            title: 'Missing Color Scheme Preferences',
            description:
              'Dark mode styles detected without respecting user color scheme preferences.',
            files: [path.relative(this.config.projectRoot, cssFile)],
            recommendations: [
              'Use prefers-color-scheme media query',
              'Ensure proper contrast in all color schemes',
              'Test with high contrast mode',
              'Provide manual theme toggle as backup',
            ],
          });
        }
      } catch {
        // Skip files that can't be read
      }
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

    // Next.js configuration analysis
    if (this.nextConfigContent) {
      strengths.push('Next.js configuration file found');

      // Check for performance optimizations in config
      if (
        this.nextConfigContent.includes('experimental') ||
        this.nextConfigContent.includes('compress') ||
        this.nextConfigContent.includes('swc')
      ) {
        strengths.push('Performance optimizations detected in config');
      }
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
