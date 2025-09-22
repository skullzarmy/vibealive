#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { NextJSAnalyzer } from './analyzer';
import { ConfigLoader } from './config/config-loader';
import { ReportGenerator } from './generators/report-generator';
import type { CLIOptions, OutputFormat } from './types';
import packageJson from '../package.json';
import { startMCPServerStdio, startMCPServerHTTP } from './mcp/server';
import { startLegacyMCPServer } from './mcp/legacy';

const program = new Command();

program
  .name('vibealive')
  .description('Universal Next.js code analysis tool')
  .version(packageJson.version);

program
  .command('analyze')
  .description('Analyze a Next.js project for unused files and dead code')
  .argument('<project-path>', 'Path to the Next.js project')
  .option('-f, --format <formats>', 'Output formats (json,md,tsv,csv)', parseFormats, [
    'json',
    'md',
  ])
  .option('-o, --output <dir>', 'Output directory for reports', './analysis-results')
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
  .command('serve')
  .description('Start the MCP server to interact with the analysis engine')
  .option('-p, --port <number>', 'Port to run the server on (HTTP mode)', '8080')
  .option('--stdio', 'Use stdio transport instead of HTTP (for direct MCP client integration)')
  .option('--legacy', 'Use legacy MCP API (deprecated, for backwards compatibility)')
  .action(async (options: any) => {
    try {
      if (options.legacy) {
        // Use legacy server implementation
        const port = parseInt(options.port, 10);
        if (isNaN(port)) {
          throw new Error('Port must be a number.');
        }
        startLegacyMCPServer(port);
      } else if (options.stdio) {
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
    if (lowConfidenceCount > 0) {
      console.log(
        chalk.yellow(
          `\n⚠️  ${lowConfidenceCount} recommendations have confidence below ${config.confidenceThreshold || 80}%. Review carefully before taking action.`
        )
      );
    }
  } catch (error) {
    spinner.fail('Analysis failed');
    throw error;
  }
}

async function initConfig(options: any): Promise<void> {
  const configPath = path.join(process.cwd(), '.vibealive.config.js');

  if ((await fs.pathExists(configPath)) && !options.force) {
    throw new Error(`Config file already exists: ${configPath}. Use --force to overwrite.`);
  }

  const configContent = ConfigLoader.generateSampleConfig();
  await fs.writeFile(configPath, configContent);

  console.log(chalk.green('✅ Created .vibealive.config.js'));
  console.log(chalk.blue('📝 Edit the file to customize your analysis settings.'));
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

program.parse();
