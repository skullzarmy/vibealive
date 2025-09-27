// VibeAlive configuration file
// This file allows you to configure build-time analysis settings

module.exports = {
  // Analysis settings
  analysis: {
    // Confidence threshold for findings (0-100)
    confidenceThreshold: 80,
    
    // Maximum number of issues allowed before failing build (CI mode)
    maxIssues: 5,
    
    // Patterns to exclude from analysis
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.vibealive/**'
    ],
    
    // Additional patterns to include (overrides default exclusions)
    include: [],
    
    // Enable dependency graph generation
    generateGraph: true,
    
    // Enable verbose logging
    verbose: false
  },
  
  // Build integration settings
  build: {
    // Fail the build if issues are found above threshold
    failOnError: false,
    
    // Show warnings in build output
    showWarnings: true,
    
    // Only run in specific environments
    environments: ['production'],
    
    // Output directory for reports
    outputDir: './vibealive-reports',
    
    // Report formats to generate during build
    formats: ['json', 'md']
  },
  
  // CI/CD specific settings
  ci: {
    // Enable CI mode (machine-readable output, exit codes)
    enabled: false,
    
    // Exit codes for different types of issues
    exitCodes: {
      unusedFiles: 1,
      deadCode: 2,
      unusedApis: 3
    },
    
    // Suppress console output except errors
    silent: false,
    
    // Different thresholds for different environments
    thresholds: {
      development: {
        maxIssues: 20,
        confidenceThreshold: 70,
        failOnError: false
      },
      staging: {
        maxIssues: 10,
        confidenceThreshold: 80,
        failOnError: true
      },
      production: {
        maxIssues: 0,
        confidenceThreshold: 95,
        failOnError: true
      }
    }
  },
  
  // Focused analysis configurations
  scans: {
    // Theme and styling analysis
    theme: {
      enabled: true,
      frameworks: ['tailwind', 'styled-components', 'emotion', 'css-modules'],
      checkDarkMode: true,
      checkResponsive: true
    },
    
    // SEO analysis
    seo: {
      enabled: true,
      checkMetadata: true,
      checkStructuredData: true,
      checkSitemap: true,
      checkRobots: true,
      checkSocialSharing: true
    },
    
    // Performance analysis
    performance: {
      enabled: true,
      checkImageOptimization: true,
      checkBundleSize: true,
      checkLoadingStates: true,
      checkCodeSplitting: true
    },
    
    // Accessibility analysis
    accessibility: {
      enabled: true,
      checkAltTags: true,
      checkSemanticHtml: true,
      checkAriaLabels: true,
      checkColorContrast: true,
      checkKeyboardNavigation: true
    }
  },
  
  // Webpack plugin configuration
  webpack: {
    // Enable webpack plugin
    enabled: false,
    
    // Plugin options (inherits from build settings by default)
    options: {
      // Override any build settings here
    }
  },
  
  // Next.js specific settings
  nextjs: {
    // Next.js versions to support
    versions: ['12', '13', '14', '15'],
    
    // Router types to analyze
    routers: ['app', 'pages', 'hybrid'],
    
    // Advanced pattern detection
    patterns: {
      routeGroups: true,
      privateFolders: true,
      interceptingRoutes: true,
      parallelRoutes: true,
      dynamicRoutes: true
    }
  },
  
  // Report generation settings
  reporting: {
    // Include project health score
    includeHealthScore: true,
    
    // Include actionable recommendations
    includeRecommendations: true,
    
    // Include dependency graph visualization
    includeDependencyGraph: true,
    
    // Template for custom reports
    template: null, // Path to custom template file
    
    // Additional metadata to include
    metadata: {
      projectName: null, // Auto-detected from package.json
      author: null,
      description: null
    }
  }
};