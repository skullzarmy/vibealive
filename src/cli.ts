#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { NextJSAnalyzer } from './analyzer';
import { ConfigLoader } from './config/config-loader';
import { ReportGenerator } from './generators/report-generator';
import type { CLIOptions, OutputFormat, AnalysisConfig } from './types';
import packageJson from '../package.json';
import { startMCPServerStdio, startMCPServerHTTP } from './mcp/server';

const program = new Command();

program
  .name('vibealive')
  .description('Universal Next.js code analysis tool')
  .version(packageJson.version);

program
  .command('analyze')
  .description('Analyze a Next.js project for unused files and dead code')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, [
    'json',
    'md',
  ])
  .option('-o, --output <dir>', 'Output directory for reports', './.vibealive/analysis-results')
  .option(
    '-e, --exclude <patterns>',
    'Additional exclude patterns (comma-separated)',
    parsePatterns
  )
  .option(
    '-i, --include <patterns>',
    'Additional include patterns (comma-separated)',
    parsePatterns
  )
  .option(
    '-c, --confidence-threshold <number>',
    'Minimum confidence threshold (0-100)',
    parseFloat,
    80
  )
  .option('-g, --generate-graph', 'Generate dependency graph visualization', true)
  .option('-p, --plugins <plugins>', 'Plugins to enable (comma-separated)', parsePatterns)
  .option('-v, --verbose', 'Verbose output')
  .option('--dry-run', 'Show what would be analyzed without running')
  .option('--force', 'Force overwrite existing reports')
  .option('--ci', 'CI-friendly mode: machine-readable output, exit codes')
  .option('--fail-on-issues', 'Exit with non-zero code if issues are found')
  .option('--max-issues <number>', 'Maximum number of issues allowed (CI mode)', parseInt, 0)
  .option('--silent', 'Suppress console output except errors')
  .option('--exit-code-unused <number>', 'Exit code for unused files found', parseInt, 1)
  .option('--exit-code-dead-code <number>', 'Exit code for dead code found', parseInt, 2)
  .option('--exit-code-api-unused <number>', 'Exit code for unused APIs found', parseInt, 3)
  .action(async (projectPath: string, options: any) => {
    try {
      await runAnalysis(projectPath, options);
    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new .vibealive.config.js file')
  .option('-f, --force', 'Overwrite existing config file')
  .action(async (options: any) => {
    try {
      await initConfig(options);
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize config:'), error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Remove VibeAlive configuration files and cleanup')
  .option('-f, --force', 'Force removal without confirmation')
  .action(async (options: any) => {
    try {
      await cleanupConfig(options);
    } catch (error) {
      console.error(chalk.red('❌ Failed to cleanup:'), error);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start the MCP server to interact with the analysis engine')
  .option('-p, --port <number>', 'Port to run the server on (HTTP mode)', '8080')
  .option('--stdio', 'Use stdio transport instead of HTTP (for direct MCP client integration)')
  .action(async (options: any) => {
    try {
      if (options.stdio) {
        // Use stdio transport for direct MCP client connections
        await startMCPServerStdio();
      } else {
        // Use HTTP transport for remote connections
        const port = parseInt(options.port, 10);
        if (isNaN(port)) {
          throw new Error('Port must be a number.');
        }
        startMCPServerHTTP(port);
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to start MCP server:'), error);
      process.exit(1);
    }
  });

program
  .command('check-file')
  .description('Check if a specific file is used in the project')
  .argument('<file-path>', 'Path to the file to check (relative to project root)')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .option('-o, --output <dir>', 'Output directory for reports', './.vibealive/analysis-results')
  .option('-v, --verbose', 'Verbose output')
  .action(async (filePath: string, projectPath: string, options: any) => {
    try {
      await runFileCheck(projectPath, filePath, options);
    } catch (error) {
      console.error(chalk.red('❌ File check failed:'), error);
      process.exit(1);
    }
  });

program
  .command('scan-directory')
  .description('Analyze files within a specific directory')
  .argument('<directory-path>', 'Directory to scan (relative to project root)')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .option('-o, --output <dir>', 'Output directory for reports', './.vibealive/analysis-results')
  .option('--no-recursive', "Don't include subdirectories")
  .option(
    '-e, --exclude <patterns>',
    'Additional exclude patterns (comma-separated)',
    parsePatterns
  )
  .option(
    '-c, --confidence-threshold <number>',
    'Minimum confidence threshold (0-100)',
    parseFloat,
    80
  )
  .option('-v, --verbose', 'Verbose output')
  .action(async (directoryPath: string, projectPath: string, options: any) => {
    try {
      await runDirectoryScan(projectPath, directoryPath, options);
    } catch (error) {
      console.error(chalk.red('❌ Directory scan failed:'), error);
      process.exit(1);
    }
  });

program
  .command('scan-component')
  .description('Analyze a component and its dependency tree')
  .argument('<component-path>', 'Path to the component to analyze')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .option('-o, --output <dir>', 'Output directory for reports', './.vibealive/analysis-results')
  .option('--max-depth <number>', 'Maximum dependency depth (1-10)', parseInt, 5)
  .option('--no-types', 'Exclude TypeScript type files')
  .option('--no-styles', 'Exclude CSS/style files')
  .option('-v, --verbose', 'Verbose output')
  .action(async (componentPath: string, projectPath: string, options: any) => {
    try {
      await runComponentScan(projectPath, componentPath, options);
    } catch (error) {
      console.error(chalk.red('❌ Component scan failed:'), error);
      process.exit(1);
    }
  });

program
  .command('scan-api')
  .description('Analyze API routes and endpoints')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .option('-o, --output <dir>', 'Output directory for reports', './.vibealive/analysis-results')
  .option('--no-middleware', 'Exclude middleware files')
  .option('--no-usage-check', "Don't check if routes are actually called")
  .option('-v, --verbose', 'Verbose output')
  .action(async (projectPath: string, options: any) => {
    try {
      await runApiScan(projectPath, options);
    } catch (error) {
      console.error(chalk.red('❌ API scan failed:'), error);
      process.exit(1);
    }
  });

// New focused analysis commands
program
  .command('theme-scan')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .description('Analyze theme setup, dark mode, and CSS framework configuration')
  .action(async (projectPath: string, options: { format: OutputFormat[] }) => {
    const startTime = Date.now();
    try {
      console.log('🎨 Analyzing theme and styling setup...');
      await runFocusedAnalysis(
        projectPath,
        options,
        'theme',
        [
          'next-themes',
          'tailwindcss',
          '@next/font',
          'next/font',
          'framer-motion',
          'styled-components',
        ],
        ['performance']
      );
      console.log('🎨 Theme analysis completed in', Date.now() - startTime, 'ms');
    } catch (error) {
      console.error(chalk.red('❌ Theme analysis failed:'), error);
      process.exit(1);
    }
  });

program
  .command('seo-scan')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .description('Audit SEO setup including metadata, sitemap, and structured data')
  .action(async (projectPath: string, options: { format: OutputFormat[] }) => {
    const startTime = Date.now();
    try {
      console.log('🔍 Auditing SEO setup...');
      await runFocusedAnalysis(
        projectPath,
        options,
        'seo',
        ['next-seo', '@vercel/analytics', '@vercel/speed-insights'],
        ['seo']
      );
      console.log('🔍 SEO audit completed in', Date.now() - startTime, 'ms');
    } catch (error) {
      console.error(chalk.red('❌ SEO audit failed:'), error);
      process.exit(1);
    }
  });

program
  .command('perf-scan')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .description('Analyze performance optimizations including images, fonts, and loading states')
  .action(async (projectPath: string, options: { format: OutputFormat[] }) => {
    const startTime = Date.now();
    try {
      console.log('⚡ Analyzing performance setup...');
      await runFocusedAnalysis(
        projectPath,
        options,
        'performance',
        ['@next/bundle-analyzer', 'next/font', '@vercel/speed-insights'],
        ['performance']
      );
      console.log('⚡ Performance analysis completed in', Date.now() - startTime, 'ms');
    } catch (error) {
      console.error(chalk.red('❌ Performance analysis failed:'), error);
      process.exit(1);
    }
  });

program
  .command('a11y-scan')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .description('Check accessibility including alt tags, semantic HTML, and ARIA attributes')
  .action(async (projectPath: string, options: { format: OutputFormat[] }) => {
    const startTime = Date.now();
    try {
      console.log('♿ Checking accessibility setup...');
      await runFocusedAnalysis(projectPath, options, 'accessibility', [], ['accessibility']);
      console.log('♿ Accessibility check completed in', Date.now() - startTime, 'ms');
    } catch (error) {
      console.error(chalk.red('❌ Accessibility check failed:'), error);
      process.exit(1);
    }
  });

program
  .command('patterns')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .description(
    'Show advanced Next.js routing patterns in use (route groups, private folders, etc.)'
  )
  .action(async (projectPath: string, options: { format: OutputFormat[] }) => {
    const startTime = Date.now();
    try {
      console.log('🔄 Analyzing Next.js routing patterns...');
      await runFocusedAnalysis(projectPath, options, 'patterns', [], []);
      console.log('🔄 Pattern analysis completed in', Date.now() - startTime, 'ms');
    } catch (error) {
      console.error(chalk.red('❌ Pattern analysis failed:'), error);
      process.exit(1);
    }
  });

program
  .command('packages')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .description('Analyze ecosystem packages and their configuration status')
  .action(async (projectPath: string, options: { format: OutputFormat[] }) => {
    const startTime = Date.now();
    try {
      console.log('📦 Analyzing package configuration...');
      await runFocusedAnalysis(projectPath, options, 'packages', [], []);
      console.log('📦 Package analysis completed in', Date.now() - startTime, 'ms');
    } catch (error) {
      console.error(chalk.red('❌ Package analysis failed:'), error);
      process.exit(1);
    }
  });

program
  .command('health')
  .argument('[project-path]', 'Path to the Next.js project (defaults to current directory)', '.')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, ['json'])
  .description('Overall project health score and comprehensive recommendations')
  .action(async (projectPath: string, options: { format: OutputFormat[] }) => {
    const startTime = Date.now();
    try {
      console.log('🏥 Generating project health report...');
      await runFocusedAnalysis(projectPath, options, 'health', [], []);
      console.log('🏥 Health report completed in', Date.now() - startTime, 'ms');
    } catch (error) {
      console.error(chalk.red('❌ Health report failed:'), error);
      process.exit(1);
    }
  });

async function runFocusedAnalysis(
  projectPath: string,
  options: { format: OutputFormat[] },
  focus: string,
  packageFilter: string[],
  categoryFilter: string[]
): Promise<void> {
  const absoluteProjectPath = path.resolve(projectPath);
  await validateNextProject(absoluteProjectPath);

  const cliOptions: CLIOptions = {
    format: options.format,
    exclude: [],
    include: [],
    plugins: [],
    confidenceThreshold: 80,
    generateGraph: false,
    verbose: false,
    dryRun: false,
  };

  const config = await ConfigLoader.loadConfig(absoluteProjectPath, cliOptions);

  const analyzer = new NextJSAnalyzer(config);
  const report = await analyzer.analyze();

  // Filter the report based on focus area
  const focusedReport = { ...report };

  if (report.nextjsAnalysis && (packageFilter.length > 0 || categoryFilter.length > 0)) {
    focusedReport.nextjsAnalysis = {
      ...report.nextjsAnalysis,
      packages:
        packageFilter.length > 0
          ? report.nextjsAnalysis.packages.filter((pkg) => packageFilter.includes(pkg.name))
          : report.nextjsAnalysis.packages,
      setupIssues:
        categoryFilter.length > 0
          ? report.nextjsAnalysis.setupIssues.filter((issue) =>
              categoryFilter.includes(issue.category)
            )
          : report.nextjsAnalysis.setupIssues,
    };
  }

  // Generate and save reports
  const outputDir = path.join(absoluteProjectPath, 'analysis-results');
  const generator = new ReportGenerator(outputDir);
  const reportFiles = await generator.generateReports(focusedReport, options.format);

  console.log(chalk.green('📄 Reports generated:'));
  reportFiles.forEach((file) => {
    console.log(`  • ${path.relative(process.cwd(), file)}`);
  });
}

async function validateNextProject(projectPath: string): Promise<void> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error('package.json not found. This does not appear to be a Next.js project.');
  }

  const packageJson = await fs.readJson(packageJsonPath);
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (!dependencies.next) {
    throw new Error(
      'Next.js dependency not found in package.json. This does not appear to be a Next.js project.'
    );
  }
}

async function runAnalysis(projectPath: string, options: any): Promise<void> {
  const absoluteProjectPath = path.resolve(projectPath);

  await validateNextProject(absoluteProjectPath);

  // Validate project path
  if (!(await fs.pathExists(absoluteProjectPath))) {
    throw new Error(`Project path does not exist: ${absoluteProjectPath}`);
  }

  const packageJsonPath = path.join(absoluteProjectPath, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error('package.json not found. Is this a Next.js project?');
  }

  if (options.dryRun) {
    console.log(chalk.blue('🔍 Dry run - showing what would be analyzed:'));
    console.log(`Project: ${absoluteProjectPath}`);
    console.log(`Output: ${path.resolve(options.output)}`);
    console.log(`Formats: ${options.format.join(', ')}`);
    console.log(`Confidence threshold: ${options.confidenceThreshold}%`);
    return;
  }

  const spinner = ora('Initializing analysis...').start();

  try {
    // Load configuration
    spinner.text = 'Loading configuration...';
    const cliOptions: CLIOptions = {
      format: options.format,
      output: options.output,
      exclude: options.exclude,
      include: options.include,
      confidenceThreshold: options.confidenceThreshold,
      generateGraph: options.generateGraph,
      plugins: options.plugins,
      verbose: options.verbose,
      dryRun: options.dryRun,
    };

    const config = await ConfigLoader.loadConfig(absoluteProjectPath, cliOptions);

    if (options.verbose) {
      spinner.info(`Configuration loaded:`);
      console.log(JSON.stringify(config, null, 2));
      spinner.start();
    }

    // Run analysis
    spinner.text = 'Running analysis...';
    const analyzer = new NextJSAnalyzer(config);
    const report = await analyzer.analyze();

    spinner.succeed('Analysis completed!');

    // Generate reports
    const reportSpinner = ora('Generating reports...').start();

    const outputDir = path.resolve(options.output);
    const reportGenerator = new ReportGenerator(outputDir);
    const generatedFiles = await reportGenerator.generateReports(report, options.format);

    reportSpinner.succeed('Reports generated!');

    // Display summary
    console.log(chalk.green('\n📊 Analysis Summary:'));
    console.log(`• Total files analyzed: ${chalk.bold(report.metadata.totalFiles)}`);
    console.log(`• Unused files found: ${chalk.bold(report.summary.unusedFiles)}`);
    console.log(`• Dead code files: ${chalk.bold(report.summary.deadCode)}`);
    console.log(`• Redundant APIs: ${chalk.bold(report.summary.redundantApis)}`);
    console.log(`• Safe deletions: ${chalk.bold(report.summary.safeDeletions.length)}`);

    if (report.summary.potentialSavings.estimatedBundleSize > 0) {
      console.log(
        `• Potential bundle size savings: ${chalk.bold(formatBytes(report.summary.potentialSavings.estimatedBundleSize))}`
      );
    }

    console.log(chalk.blue('\n📁 Generated reports:'));
    generatedFiles.forEach((file) => {
      console.log(`• ${path.relative(process.cwd(), file)}`);
    });

    // Show top recommendations
    if (report.recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 Top Recommendations:'));
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(
          `${index + 1}. ${rec.type}: ${path.relative(process.cwd(), rec.target)} (${rec.confidence}% confidence)`
        );
      });

      if (report.recommendations.length > 5) {
        console.log(
          `   ... and ${report.recommendations.length - 5} more (see reports for details)`
        );
      }
    }

    // Warning for low confidence findings
    const lowConfidenceCount = report.recommendations.filter(
      (r) => r.confidence < (config.confidenceThreshold || 80)
    ).length;
    if (lowConfidenceCount > 0 && !options.silent) {
      console.log(
        chalk.yellow(
          `\n⚠️  ${lowConfidenceCount} recommendations have confidence below ${config.confidenceThreshold || 80}%. Review carefully before taking action.`
        )
      );
    }

    // Handle CI mode and exit codes
    if (options.ci || options.failOnIssues) {
      const totalIssues =
        report.summary.unusedFiles + report.summary.deadCode + report.summary.redundantApis;

      if (options.ci && !options.silent) {
        // Output machine-readable summary for CI
        console.log(
          JSON.stringify({
            status: totalIssues > options.maxIssues ? 'failure' : 'success',
            totalIssues,
            unusedFiles: report.summary.unusedFiles,
            deadCode: report.summary.deadCode,
            redundantApis: report.summary.redundantApis,
            maxIssuesAllowed: options.maxIssues,
            reports: generatedFiles.map((f) => path.relative(process.cwd(), f)),
          })
        );
      }

      // Exit with appropriate code if issues exceed threshold
      if (totalIssues > options.maxIssues) {
        const exitCode =
          report.summary.unusedFiles > 0
            ? options.exitCodeUnused
            : report.summary.deadCode > 0
              ? options.exitCodeDeadCode
              : report.summary.redundantApis > 0
                ? options.exitCodeApiUnused
                : 1;

        if (!options.silent) {
          console.error(
            chalk.red(`\n❌ Found ${totalIssues} issues (max allowed: ${options.maxIssues})`)
          );
        }
        process.exit(exitCode);
      } else if (!options.silent) {
        console.log(
          chalk.green(`\n✅ Issues within acceptable range: ${totalIssues}/${options.maxIssues}`)
        );
      }
    }
  } catch (error) {
    spinner.fail('Analysis failed');
    throw error;
  }
}

async function runFileCheck(projectPath: string, filePath: string, options: any): Promise<void> {
  const absoluteProjectPath = path.resolve(projectPath);
  await validateNextProject(absoluteProjectPath);

  const spinner = ora(`Checking file: ${filePath}`).start();

  try {
    const config: AnalysisConfig = {
      projectRoot: absoluteProjectPath,
      nextVersion: 'auto-detect',
      routerType: 'hybrid',
      typescript: true,
      excludePatterns: [],
      includePatterns: [filePath],
      confidenceThreshold: options.confidenceThreshold,
    };

    const analyzer = new NextJSAnalyzer(config);
    const report = await analyzer.analyze();

    // Filter to just the requested file
    const targetFile = report.files.find((f) => f.path.endsWith(filePath));
    if (!targetFile) {
      spinner.fail(`File not found: ${filePath}`);
      return;
    }

    const filteredReport = {
      ...report,
      files: [targetFile],
      summary: {
        ...report.summary,
        totalFiles: 1,
        unusedFiles: targetFile.classification === 'UNUSED' ? 1 : 0,
        deadCode: targetFile.classification === 'DEAD_CODE' ? 1 : 0,
      },
    };

    spinner.succeed('File check completed!');

    // Generate reports
    const outputDir = path.resolve(options.output);
    const reportGenerator = new ReportGenerator(outputDir);
    const generatedFiles = await reportGenerator.generateReports(filteredReport, options.format);

    // Display results
    console.log(chalk.green(`\n📄 File Analysis: ${filePath}`));
    console.log(`• Classification: ${chalk.bold(targetFile.classification)}`);
    console.log(`• Confidence: ${chalk.bold(targetFile.confidence)}%`);
    console.log(`• Usage locations: ${chalk.bold(targetFile.usageLocations.length)}`);

    if (targetFile.classification === 'UNUSED') {
      console.log(chalk.yellow('\n⚠️  This file appears to be unused.'));
    } else if (targetFile.classification === 'DEAD_CODE') {
      console.log(chalk.red('\n💀 This file contains dead code.'));
    } else {
      console.log(chalk.green('\n✅ This file is actively used.'));
    }

    console.log(chalk.blue('\n📁 Generated reports:'));
    generatedFiles.forEach((file) => {
      console.log(`• ${path.relative(process.cwd(), file)}`);
    });
  } catch (error) {
    spinner.fail('File check failed');
    throw error;
  }
}

async function runDirectoryScan(
  projectPath: string,
  directoryPath: string,
  options: any
): Promise<void> {
  const absoluteProjectPath = path.resolve(projectPath);
  await validateNextProject(absoluteProjectPath);

  const spinner = ora(`Scanning directory: ${directoryPath}`).start();

  try {
    const includePattern =
      options.recursive !== false ? `${directoryPath}/**/*` : `${directoryPath}/*`;

    const config: AnalysisConfig = {
      projectRoot: absoluteProjectPath,
      nextVersion: 'auto-detect',
      routerType: 'hybrid',
      typescript: true,
      excludePatterns: options.exclude || [],
      includePatterns: [includePattern],
      confidenceThreshold: options.confidenceThreshold,
    };

    const analyzer = new NextJSAnalyzer(config);
    const report = await analyzer.analyze();

    spinner.succeed('Directory scan completed!');

    // Generate reports
    const outputDir = path.resolve(options.output);
    const reportGenerator = new ReportGenerator(outputDir);
    const generatedFiles = await reportGenerator.generateReports(report, options.format);

    // Display summary
    console.log(chalk.green(`\n📂 Directory Analysis: ${directoryPath}`));
    console.log(`• Total files analyzed: ${chalk.bold(report.files.length)}`);
    console.log(
      `• Unused files: ${chalk.bold(report.files.filter((f) => f.classification === 'UNUSED').length)}`
    );
    console.log(
      `• Dead code files: ${chalk.bold(report.files.filter((f) => f.classification === 'DEAD_CODE').length)}`
    );
    console.log(
      `• Active files: ${chalk.bold(report.files.filter((f) => f.classification === 'ACTIVE').length)}`
    );

    console.log(chalk.blue('\n📁 Generated reports:'));
    generatedFiles.forEach((file) => {
      console.log(`• ${path.relative(process.cwd(), file)}`);
    });
  } catch (error) {
    spinner.fail('Directory scan failed');
    throw error;
  }
}

async function runComponentScan(
  projectPath: string,
  componentPath: string,
  options: any
): Promise<void> {
  const absoluteProjectPath = path.resolve(projectPath);
  await validateNextProject(absoluteProjectPath);

  const spinner = ora(`Analyzing component tree: ${componentPath}`).start();

  try {
    // Run full analysis to get dependency graph
    const config: AnalysisConfig = {
      projectRoot: absoluteProjectPath,
      nextVersion: 'auto-detect',
      routerType: 'hybrid',
      typescript: true,
      excludePatterns: [],
      includePatterns: [],
      generateGraph: true,
      confidenceThreshold: options.confidenceThreshold,
    };

    const analyzer = new NextJSAnalyzer(config);
    const fullReport = await analyzer.analyze();

    // Find the target component
    const targetFile = fullReport.files.find((f) => f.path.endsWith(componentPath));
    if (!targetFile) {
      spinner.fail(`Component not found: ${componentPath}`);
      return;
    }

    // Build dependency tree (simplified version)
    const relatedFiles = fullReport.files.filter((f) => {
      return (
        f.path === targetFile.path ||
        f.usageLocations.some((loc) => loc.filePath.includes(componentPath)) ||
        targetFile.usageLocations.some((loc) => loc.filePath.includes(f.path))
      );
    });

    const componentReport = {
      ...fullReport,
      files: relatedFiles,
      summary: {
        ...fullReport.summary,
        totalFiles: relatedFiles.length,
        unusedFiles: relatedFiles.filter((f) => f.classification === 'UNUSED').length,
        deadCode: relatedFiles.filter((f) => f.classification === 'DEAD_CODE').length,
      },
      metadata: {
        ...fullReport.metadata,
        analysisType: 'component-tree',
        rootComponent: componentPath,
      },
    };

    spinner.succeed('Component analysis completed!');

    // Generate reports
    const outputDir = path.resolve(options.output);
    const reportGenerator = new ReportGenerator(outputDir);
    const generatedFiles = await reportGenerator.generateReports(componentReport, options.format);

    // Display summary
    console.log(chalk.green(`\n🧩 Component Tree Analysis: ${componentPath}`));
    console.log(`• Root component: ${chalk.bold(targetFile.classification)}`);
    console.log(`• Related files: ${chalk.bold(relatedFiles.length)}`);
    console.log(
      `• Unused in tree: ${chalk.bold(relatedFiles.filter((f) => f.classification === 'UNUSED').length)}`
    );

    console.log(chalk.blue('\n📁 Generated reports:'));
    generatedFiles.forEach((file) => {
      console.log(`• ${path.relative(process.cwd(), file)}`);
    });
  } catch (error) {
    spinner.fail('Component analysis failed');
    throw error;
  }
}

async function runApiScan(projectPath: string, options: any): Promise<void> {
  const absoluteProjectPath = path.resolve(projectPath);
  await validateNextProject(absoluteProjectPath);

  const spinner = ora('Scanning API routes...').start();

  try {
    const apiPatterns = [
      'pages/api/**/*',
      'src/pages/api/**/*',
      'app/api/**/*',
      'src/app/api/**/*',
    ];

    if (options.middleware !== false) {
      apiPatterns.push('middleware.*', 'src/middleware.*');
    }

    const config: AnalysisConfig = {
      projectRoot: absoluteProjectPath,
      nextVersion: 'auto-detect',
      routerType: 'hybrid',
      typescript: true,
      excludePatterns: [],
      includePatterns: apiPatterns,
      confidenceThreshold: options.confidenceThreshold,
    };

    const analyzer = new NextJSAnalyzer(config);
    const report = await analyzer.analyze();

    // Filter to only API-related files
    const apiFiles = report.files.filter(
      (f) =>
        f.path.includes('/api/') ||
        f.path.includes('middleware') ||
        f.path.endsWith('.api.ts') ||
        f.path.endsWith('.api.js')
    );

    const apiReport = {
      ...report,
      files: apiFiles,
      summary: {
        ...report.summary,
        totalFiles: apiFiles.length,
        unusedFiles: apiFiles.filter((f) => f.classification === 'UNUSED').length,
        redundantApis: apiFiles.filter((f) => f.classification === 'UNUSED').length,
      },
      metadata: {
        ...report.metadata,
        analysisType: 'api-routes',
      },
    };

    spinner.succeed('API scan completed!');

    // Generate reports
    const outputDir = path.resolve(options.output);
    const reportGenerator = new ReportGenerator(outputDir);
    const generatedFiles = await reportGenerator.generateReports(apiReport, options.format);

    // Display summary
    console.log(chalk.green('\n🚀 API Routes Analysis'));
    console.log(`• Total API files: ${chalk.bold(apiFiles.length)}`);
    console.log(
      `• Unused routes: ${chalk.bold(apiFiles.filter((f) => f.classification === 'UNUSED').length)}`
    );
    console.log(
      `• Active routes: ${chalk.bold(apiFiles.filter((f) => f.classification === 'ACTIVE').length)}`
    );

    console.log(chalk.blue('\n📁 Generated reports:'));
    generatedFiles.forEach((file) => {
      console.log(`• ${path.relative(process.cwd(), file)}`);
    });
  } catch (error) {
    spinner.fail('API scan failed');
    throw error;
  }
}

async function initConfig(options: any): Promise<void> {
  const vibeAliveDir = path.join(process.cwd(), '.vibealive');
  const configPath = path.join(vibeAliveDir, 'config.js');
  const gitignorePath = path.join(process.cwd(), '.gitignore');

  // Check if config already exists
  const configExists = await fs.pathExists(configPath);
  if (configExists && !options.force) {
    console.log(chalk.yellow('⚠️  Configuration file already exists!'));
    console.log(chalk.gray(`   ${configPath}`));

    const shouldOverwrite = await promptUser(
      'Would you like to overwrite the existing configuration? [y/N]: '
    );

    if (shouldOverwrite.toLowerCase() !== 'y' && shouldOverwrite.toLowerCase() !== 'yes') {
      console.log(chalk.blue('ℹ️  Initialization cancelled. Existing config preserved.'));
      return;
    }

    console.log(chalk.yellow('📝 Overwriting existing configuration...'));
  }

  // Create or overwrite the config file
  await fs.ensureDir(vibeAliveDir); // Ensure .vibealive directory exists
  const configContent = ConfigLoader.generateSampleConfig();
  await fs.writeFile(configPath, configContent);

  if (configExists) {
    console.log(chalk.green('✅ Updated .vibealive/config.js'));
  } else {
    console.log(chalk.green('✅ Created .vibealive/config.js'));
  }
  console.log(chalk.blue('📝 Edit the file to customize your analysis settings.'));

  // Handle .gitignore intelligently
  const gitignoreExists = await fs.pathExists(gitignorePath);

  if (!gitignoreExists) {
    // No .gitignore exists
    console.log(chalk.yellow('\n📝 No .gitignore file found.'));

    const shouldCreateGitignore = await promptUser(
      'Would you like to create a .gitignore file with VibeAlive entry? [Y/n]: '
    );

    if (
      shouldCreateGitignore.toLowerCase() !== 'n' &&
      shouldCreateGitignore.toLowerCase() !== 'no'
    ) {
      try {
        const gitignoreContent = `# VibeAlive\n.vibealive/\n`;
        await fs.writeFile(gitignorePath, gitignoreContent);
        console.log(chalk.green('✅ Created .gitignore with VibeAlive entry'));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(chalk.yellow(`⚠️  Could not create .gitignore: ${errorMessage}`));
      }
    } else {
      console.log(chalk.blue('ℹ️  Skipped creating .gitignore.'));
      console.log(chalk.gray('   💡 Consider adding .vibealive/ to your .gitignore manually.'));
    }
  } else {
    // .gitignore exists - check what's already in it
    console.log(chalk.yellow('\n🔍 Found .gitignore file.'));

    const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    const hasVibeAliveEntry = gitignoreContent.includes('.vibealive/');

    if (hasVibeAliveEntry) {
      console.log(chalk.green('✅ .vibealive/ already in .gitignore'));
    } else {
      // .vibealive/ entry is missing
      console.log(chalk.yellow('📋 Missing .vibealive/ entry in .gitignore'));

      const shouldAddEntry = await promptUser(
        'Would you like to add .vibealive/ to .gitignore? [Y/n]: '
      );

      if (shouldAddEntry.toLowerCase() !== 'n' && shouldAddEntry.toLowerCase() !== 'no') {
        try {
          const gitignoreAddition = '\n# VibeAlive\n.vibealive/\n';
          await fs.appendFile(gitignorePath, gitignoreAddition);
          console.log(chalk.green('✅ Added .vibealive/ to .gitignore'));
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(chalk.yellow(`⚠️  Could not update .gitignore: ${errorMessage}`));
          console.log(chalk.gray('   You may want to add .vibealive/ manually.'));
        }
      } else {
        console.log(chalk.blue('ℹ️  Skipped updating .gitignore.'));
        console.log(
          chalk.gray(
            '   💡 Consider adding .vibealive/ manually to prevent committing local configs.'
          )
        );
      }
    }
  }

  // Final summary
  console.log(chalk.green('\n🎉 Initialization complete!'));
  console.log(chalk.blue('Next steps:'));
  console.log(chalk.gray('   1. Review and customize .vibealive/config.js if needed'));
  console.log(chalk.gray('   2. Run `vibealive analyze` to start analyzing your project'));
}

async function cleanupConfig(options: any): Promise<void> {
  const vibeAliveDir = path.join(process.cwd(), '.vibealive');

  // Check what exists
  const vibeAliveDirExists = await fs.pathExists(vibeAliveDir);

  if (!vibeAliveDirExists) {
    console.log(chalk.blue('🔍 No VibeAlive files found to cleanup.'));
    return;
  }

  // Count analysis reports
  let reportCount = 0;
  const reportLocations: string[] = [];

  try {
    const vibeAliveContents = await fs.readdir(vibeAliveDir, { withFileTypes: true });
    for (const item of vibeAliveContents) {
      if (item.isDirectory() && item.name.includes('analysis')) {
        const reportDir = path.join(vibeAliveDir, item.name);
        const reports = await fs.readdir(reportDir);
        reportCount += reports.length;
        reportLocations.push(`${vibeAliveDir}/${item.name}`);
      } else if (
        item.isFile() &&
        (item.name.includes('analysis') || item.name.endsWith('.json') || item.name.endsWith('.md'))
      ) {
        reportCount++;
        reportLocations.push(`${vibeAliveDir}/${item.name}`);
      }
    }
  } catch {
    // Ignore errors reading directory
  }

  // Show what will be removed
  console.log(chalk.yellow('🧹 VibeAlive Cleanup'));
  console.log('The following will be removed:');
  console.log(chalk.gray(`  • ${vibeAliveDir}/ (entire VibeAlive directory)`));

  if (reportCount > 0) {
    console.log(chalk.yellow(`\n📊 Found ${reportCount} analysis report(s) in:`));
    reportLocations.forEach((location) => {
      console.log(chalk.gray(`     ${location}`));
    });
  }

  if (!options.force) {
    const shouldProceed = await promptUser(
      `\n⚠️  This will permanently delete the entire .vibealive directory and ${reportCount} report(s). Continue? [y/N]: `
    );

    if (shouldProceed.toLowerCase() !== 'y' && shouldProceed.toLowerCase() !== 'yes') {
      console.log(chalk.blue('ℹ️  Cleanup cancelled.'));
      return;
    }
  }

  // Perform cleanup
  try {
    await fs.remove(vibeAliveDir);
    console.log(chalk.green('✅ Removed .vibealive directory'));
    console.log(chalk.green('\n🎉 Cleanup completed!'));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`❌ Failed to remove .vibealive directory: ${errorMessage}`));
  }
}

function parseFormats(value: string): OutputFormat[] {
  const formats = value.split(',').map((f) => f.trim()) as OutputFormat[];
  const validFormats: OutputFormat[] = ['json', 'md', 'tsv', 'csv'];

  for (const format of formats) {
    if (!validFormats.includes(format)) {
      throw new Error(`Invalid format: ${format}. Valid formats: ${validFormats.join(', ')}`);
    }
  }

  return formats;
}

function parsePatterns(value: string): string[] {
  return value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

program.parse();
