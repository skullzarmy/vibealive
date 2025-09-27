// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import chalk from 'chalk';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { JobManager } from './job-manager';
import { NextJSAnalyzer } from '../analyzer';
import { AnalysisConfig } from '../types';

const jobManager = new JobManager();

/**
 * Creates a new MCP server instance with all the necessary tools and resources
 * Following MCP TypeScript SDK v2025-03-26 standards
 */
function createMCPServer(): McpServer {
  const server = new McpServer(
    {
      name: 'vibealive',
      version: '0.3.0',
    },
    {
      // Enable notification debouncing for performance
      debouncedNotificationMethods: [
        'notifications/tools/list_changed',
        'notifications/resources/list_changed',
        'notifications/prompts/list_changed',
      ],
    }
  );

  // Tool: Analyze Next.js project
  server.registerTool(
    'analyze-project',
    {
      title: 'Analyze Next.js Project',
      description:
        'Initiates a full, asynchronous analysis of a Next.js project to identify unused code, dead components, and redundant API endpoints.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project to analyze'),
        options: z
          .object({
            exclude: z
              .array(z.string())
              .optional()
              .describe('Glob patterns to exclude from analysis'),
            include: z
              .array(z.string())
              .optional()
              .describe('Glob patterns to include in analysis'),
            confidenceThreshold: z
              .number()
              .min(0)
              .max(100)
              .optional()
              .describe('Minimum confidence threshold for findings (0-100)'),
            generateGraph: z.boolean().optional().describe('Whether to generate dependency graph'),
            plugins: z.array(z.string()).optional().describe('Additional analysis plugins to run'),
            verbose: z.boolean().optional().describe('Enable verbose output'),
          })
          .optional()
          .describe('Analysis configuration options'),
      },
    },
    async ({ projectPath, options = {} }) => {
      try {
        const job = jobManager.createJob();

        // Start analysis in the background
        (async () => {
          try {
            jobManager.updateJobStatus(job.id, 'processing', 'Starting analysis...');

            // Create a proper analysis config by setting required fields with defaults
            const config: AnalysisConfig = {
              projectRoot: projectPath,
              nextVersion: 'auto-detect',
              routerType: 'hybrid',
              typescript: true,
              excludePatterns: options.exclude || [],
              includePatterns: options.include || [],
              ...options,
            };

            const analyzer = new NextJSAnalyzer(config);
            const report = await analyzer.analyze();
            jobManager.completeJob(job.id, report);
          } catch (e: any) {
            jobManager.failJob(job.id, e.message);
          }
        })();

        return {
          content: [
            {
              type: 'text' as const,
              text: `Analysis started for project: ${projectPath}\nJob ID: ${job.id}\nStatus: ${job.status}\n\nUse the get-job-status tool to check progress.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error starting analysis: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get job status
  server.registerTool(
    'get-job-status',
    {
      title: 'Get Analysis Job Status',
      description: 'Checks the status of an analysis job by job ID.',
      inputSchema: {
        jobId: z.string().describe('The job ID returned from analyze-project'),
      },
    },
    async ({ jobId }) => {
      try {
        const job = jobManager.getJob(jobId);
        if (!job) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Job not found: ${jobId}`,
              },
            ],
            isError: true,
          };
        }

        let statusText = `Job ID: ${job.id}\nStatus: ${job.status}\nProgress: ${job.progress}%\nMessage: ${job.message}`;

        if (job.error) {
          statusText += `\nError: ${job.error}`;
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: statusText,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error getting job status: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get analysis report
  server.registerTool(
    'get-analysis-report',
    {
      title: 'Get Analysis Report',
      description: 'Retrieves the full analysis report for a completed job.',
      inputSchema: {
        jobId: z.string().describe('The job ID of a completed analysis'),
        format: z
          .enum(['json', 'summary'])
          .optional()
          .describe('Report format - full JSON or summary'),
      },
    },
    async ({ jobId, format = 'summary' }) => {
      try {
        const job = jobManager.getJob(jobId);
        if (!job) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Job not found: ${jobId}`,
              },
            ],
            isError: true,
          };
        }

        if (job.status !== 'completed' || !job.result) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Job is not completed or has no result. Status: ${job.status}`,
              },
            ],
            isError: true,
          };
        }

        if (format === 'json') {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(job.result, null, 2),
              },
            ],
          };
        } else {
          // Generate a summary
          const report = job.result;
          const summary = `
Analysis Report for ${report.metadata.projectRoot}

Summary:
- Total files analyzed: ${report.files.length}
- Unused files: ${report.files.filter((f) => f.classification === 'UNUSED').length}
- Auto-invoked files: ${report.files.filter((f) => f.classification === 'AUTO_INVOKED').length}
- Active files: ${report.files.filter((f) => f.classification === 'ACTIVE').length}
- Dead code files: ${report.files.filter((f) => f.classification === 'DEAD_CODE').length}

Analysis Date: ${report.metadata.analysisDate}

Top Issues:
${report.recommendations
  .slice(0, 5)
  .map((r) => `- ${r.type}: ${r.description}`)
  .join('\n')}

Use format="json" for the full detailed report.
          `;

          return {
            content: [
              {
                type: 'text' as const,
                text: summary.trim(),
              },
            ],
          };
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error getting analysis report: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get file details
  server.registerTool(
    'get-file-details',
    {
      title: 'Get File Analysis Details',
      description: 'Retrieves detailed analysis for a specific file from a completed analysis.',
      inputSchema: {
        jobId: z.string().describe('The job ID of a completed analysis'),
        filePath: z.string().describe('Path to the file to get details for'),
      },
    },
    async ({ jobId, filePath }) => {
      try {
        const job = jobManager.getJob(jobId);
        if (!job || job.status !== 'completed' || !job.result) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Job not found or not completed: ${jobId}`,
              },
            ],
            isError: true,
          };
        }

        const fileAnalysis = job.result.files.find((f) => f.path === filePath);
        if (!fileAnalysis) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `File not found in analysis: ${filePath}`,
              },
            ],
            isError: true,
          };
        }

        const details = `
File: ${fileAnalysis.path}
Classification: ${fileAnalysis.classification}
Confidence: ${fileAnalysis.confidence}%

Reasons:
${fileAnalysis.reasons.map((r) => `- ${r}`).join('\n')}

Export Count: ${fileAnalysis.exportCount}
Import Count: ${fileAnalysis.importCount}
Usage Locations: ${fileAnalysis.usageLocations.length}

${fileAnalysis.bundleSize ? `Bundle Size: ${fileAnalysis.bundleSize} bytes` : ''}
        `;

        return {
          content: [
            {
              type: 'text' as const,
              text: details.trim(),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error getting file details: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Check single file usage
  server.registerTool(
    'check-file',
    {
      title: 'Check Single File Usage',
      description:
        'Quickly check if a specific file is used in the project without running a full analysis.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project'),
        filePath: z.string().describe('Path to the file to check (relative to project root)'),
      },
    },
    async ({ projectPath, filePath }) => {
      try {
        const job = jobManager.createJob();

        // Start quick file check in the background
        (async () => {
          try {
            jobManager.updateJobStatus(job.id, 'processing', `Checking file: ${filePath}`);

            const config: AnalysisConfig = {
              projectRoot: projectPath,
              nextVersion: 'auto-detect',
              routerType: 'hybrid',
              typescript: true,
              excludePatterns: [],
              includePatterns: [filePath], // Focus on this file
            };

            const analyzer = new NextJSAnalyzer(config);
            const report = await analyzer.analyze();

            // Filter to just the requested file
            const targetFile = report.files.find((f) => f.path.endsWith(filePath));
            if (targetFile) {
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
              jobManager.completeJob(job.id, filteredReport);
            } else {
              jobManager.failJob(job.id, `File not found: ${filePath}`);
            }
          } catch (e: any) {
            jobManager.failJob(job.id, e.message);
          }
        })();

        return {
          content: [
            {
              type: 'text' as const,
              text: `File check started: ${filePath}\nJob ID: ${job.id}\n\nUse get-job-status and get-analysis-report to get results.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error checking file: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Scan directory
  server.registerTool(
    'scan-directory',
    {
      title: 'Scan Directory',
      description: 'Analyze files within a specific directory and its subdirectories.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project'),
        directoryPath: z.string().describe('Directory to scan (relative to project root)'),
        options: z
          .object({
            recursive: z.boolean().optional().default(true).describe('Include subdirectories'),
            exclude: z.array(z.string()).optional().describe('Additional exclude patterns'),
            confidenceThreshold: z
              .number()
              .min(0)
              .max(100)
              .optional()
              .describe('Confidence threshold'),
          })
          .optional(),
      },
    },
    async ({ projectPath, directoryPath, options = {} }) => {
      try {
        const job = jobManager.createJob();

        (async () => {
          try {
            jobManager.updateJobStatus(
              job.id,
              'processing',
              `Scanning directory: ${directoryPath}`
            );

            const includePattern = options.recursive
              ? `${directoryPath}/**/*`
              : `${directoryPath}/*`;

            const config: AnalysisConfig = {
              projectRoot: projectPath,
              nextVersion: 'auto-detect',
              routerType: 'hybrid',
              typescript: true,
              excludePatterns: options.exclude || [],
              includePatterns: [includePattern],
              confidenceThreshold: options.confidenceThreshold,
            };

            const analyzer = new NextJSAnalyzer(config);
            const report = await analyzer.analyze();
            jobManager.completeJob(job.id, report);
          } catch (e: any) {
            jobManager.failJob(job.id, e.message);
          }
        })();

        return {
          content: [
            {
              type: 'text' as const,
              text: `Directory scan started: ${directoryPath}\nRecursive: ${options.recursive}\nJob ID: ${job.id}\n\nUse get-job-status and get-analysis-report to get results.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error scanning directory: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Scan component tree
  server.registerTool(
    'scan-component-tree',
    {
      title: 'Scan Component Tree',
      description:
        'Analyze a component and all its dependencies to see what would be affected if removed.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project'),
        componentPath: z.string().describe('Path to the root component to analyze'),
        options: z
          .object({
            maxDepth: z
              .number()
              .min(1)
              .max(10)
              .optional()
              .default(5)
              .describe('Maximum dependency depth'),
            includeTypes: z
              .boolean()
              .optional()
              .default(true)
              .describe('Include TypeScript type files'),
            includeStyles: z.boolean().optional().default(true).describe('Include CSS/style files'),
          })
          .optional(),
      },
    },
    async ({ projectPath, componentPath, options = {} }) => {
      try {
        const job = jobManager.createJob();

        (async () => {
          try {
            jobManager.updateJobStatus(
              job.id,
              'processing',
              `Analyzing component tree: ${componentPath}`
            );

            // First run a full analysis to get dependency graph
            const config: AnalysisConfig = {
              projectRoot: projectPath,
              nextVersion: 'auto-detect',
              routerType: 'hybrid',
              typescript: true,
              excludePatterns: [],
              includePatterns: [],
              generateGraph: true, // Important for dependency tracking
            };

            const analyzer = new NextJSAnalyzer(config);
            const fullReport = await analyzer.analyze();

            // Find the target component and its dependencies
            const targetFile = fullReport.files.find((f) => f.path.endsWith(componentPath));
            if (!targetFile) {
              jobManager.failJob(job.id, `Component not found: ${componentPath}`);
              return;
            }

            // Build dependency tree (this would need to be implemented in the analyzer)
            // For now, we'll return the component and its immediate dependencies
            const relatedFiles = fullReport.files.filter((f) => {
              // Simple heuristic: files that import this component or are imported by it
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

            jobManager.completeJob(job.id, componentReport);
          } catch (e: any) {
            jobManager.failJob(job.id, e.message);
          }
        })();

        return {
          content: [
            {
              type: 'text' as const,
              text: `Component tree analysis started: ${componentPath}\nMax depth: ${options.maxDepth}\nJob ID: ${job.id}\n\nUse get-job-status and get-analysis-report to get results.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing component tree: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Scan API routes
  server.registerTool(
    'scan-api-routes',
    {
      title: 'Scan API Routes',
      description: 'Analyze only API routes to identify unused endpoints and their dependencies.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project'),
        options: z
          .object({
            includeMiddleware: z
              .boolean()
              .optional()
              .default(true)
              .describe('Include middleware files'),
            checkUsage: z
              .boolean()
              .optional()
              .default(true)
              .describe('Check if routes are actually called'),
          })
          .optional(),
      },
    },
    async ({ projectPath, options = {} }) => {
      try {
        const job = jobManager.createJob();

        (async () => {
          try {
            jobManager.updateJobStatus(job.id, 'processing', 'Scanning API routes...');

            const apiPatterns = [
              'pages/api/**/*',
              'src/pages/api/**/*',
              'app/api/**/*',
              'src/app/api/**/*',
            ];

            if (options.includeMiddleware) {
              apiPatterns.push('middleware.*', 'src/middleware.*');
            }

            const config: AnalysisConfig = {
              projectRoot: projectPath,
              nextVersion: 'auto-detect',
              routerType: 'hybrid',
              typescript: true,
              excludePatterns: [],
              includePatterns: apiPatterns,
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

            jobManager.completeJob(job.id, apiReport);
          } catch (e: any) {
            jobManager.failJob(job.id, e.message);
          }
        })();

        return {
          content: [
            {
              type: 'text' as const,
              text: `API routes scan started\nInclude middleware: ${options.includeMiddleware}\nCheck usage: ${options.checkUsage}\nJob ID: ${job.id}\n\nUse get-job-status and get-analysis-report to get results.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error scanning API routes: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Resource: Server status
  server.registerResource(
    'server-status',
    'status://server',
    {
      title: 'Server Status',
      description: 'Current status of the VibeAlive MCP server',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'status://server',
          text: JSON.stringify(
            {
              status: 'running',
              version: '0.3.0',
              activeJobs: Array.from(jobManager['jobs'].values()).filter(
                (j) => j.status === 'processing'
              ).length,
              totalJobs: jobManager['jobs'].size,
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // Tool: Get CLI Commands (informational)
  server.registerTool(
    'get-cli-commands',
    {
      title: 'Get Available CLI Commands',
      description:
        'Returns information about available CLI commands and options for vibealive. This is informational only - agents cannot execute CLI commands directly.',
      inputSchema: {
        category: z
          .enum(['all', 'analysis', 'configuration', 'export'])
          .optional()
          .describe('Filter commands by category (optional)'),
      },
    },
    async ({ category }) => {
      const allCommands = {
        analysis: [
          'vibealive analyze [project-path] - Analyze a Next.js project for unused files',
          '  Options: -f,--format <formats>, -o,--output <dir>, -e,--exclude <patterns>',
          '  Example: vibealive analyze --format csv,json --confidence-threshold 90',
          '',
          'vibealive check-file <file-path> [project-path] - Check if a specific file is used',
          '  Options: -f,--format <formats>, -v,--verbose',
          '  Example: vibealive check-file src/components/Button.tsx',
          '',
          'vibealive scan-directory <directory-path> [project-path] - Analyze files in directory',
          '  Options: -f,--format <formats>, --no-recursive, -e,--exclude <patterns>',
          '  Example: vibealive scan-directory src/components',
          '',
          'vibealive scan-component <component-path> [project-path] - Analyze component tree',
          '  Options: -f,--format <formats>, --max-depth <number>, --no-types, --no-styles',
          '  Example: vibealive scan-component src/components/Header.tsx',
          '',
          'vibealive scan-api [project-path] - Analyze API routes and endpoints',
          '  Options: -f,--format <formats>, --no-middleware, --no-usage-check',
          '  Example: vibealive scan-api --no-middleware',
          '',
          '## Focused Analysis Commands',
          'vibealive theme-scan [project-path] - Analyze theme setup and styling',
          '  Options: -f,--format <formats>',
          '  Example: vibealive theme-scan --format md',
          '',
          'vibealive seo-scan [project-path] - Audit SEO metadata and configuration',
          '  Options: -f,--format <formats>',
          '  Example: vibealive seo-scan --format json',
          '',
          'vibealive perf-scan [project-path] - Analyze performance optimizations',
          '  Options: -f,--format <formats>',
          '  Example: vibealive perf-scan --format md',
          '',
          'vibealive a11y-scan [project-path] - Check accessibility compliance',
          '  Options: -f,--format <formats>',
          '  Example: vibealive a11y-scan --format json',
          '',
          'vibealive patterns [project-path] - Show advanced Next.js routing patterns',
          '  Options: -f,--format <formats>',
          '  Example: vibealive patterns --format md',
          '',
          'vibealive packages [project-path] - Analyze ecosystem packages configuration',
          '  Options: -f,--format <formats>',
          '  Example: vibealive packages --format json',
          '',
          'vibealive health [project-path] - Generate project health report',
          '  Options: -f,--format <formats>',
          '  Example: vibealive health --format md',
        ],
        configuration: [
          'vibealive init - Initialize a new .vibealive/config.js configuration file',
          '  Options: -f,--force',
          '  Example: vibealive init --force',
          '',
          'vibealive cleanup - Remove VibeAlive configuration and analysis results',
          '  Options: -f,--force',
          '  Example: vibealive cleanup --force',
        ],
        export: [
          'Output Formats:',
          '  json - Structured JSON data for programmatic use',
          '  md   - Markdown report for human reading',
          '  tsv  - Tab-separated values for spreadsheet import',
          '  csv  - Comma-separated values for spreadsheet import',
          '',
          'Default Output Location: ./.vibealive/analysis-results/',
          'File Naming: analysis-report-YYYY-MM-DDTHH-MM-SS-sssZ.{format}',
          '',
          'Examples:',
          '  --format json,md,csv',
          '  --output ./reports --format tsv',
        ],
      };

      let commands: string[] = [];

      if (!category || category === 'all') {
        commands = [
          '# VibeAlive CLI Commands',
          '',
          '## Analysis Commands',
          ...allCommands.analysis,
          '',
          '## Configuration Commands',
          ...allCommands.configuration,
          '',
          '## Export Options',
          ...allCommands.export,
          '',
          '## General Notes',
          '- All commands support --help for detailed usage',
          '- Analysis results are timestamped to prevent overwrites',
          '- Configuration is stored in .vibealive/config.js',
          '- Use vibealive --version to check current version',
        ];
      } else {
        commands = [
          `# VibeAlive ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`,
          '',
          ...allCommands[category as keyof typeof allCommands],
        ];
      }

      return {
        content: [
          {
            type: 'text',
            text: commands.join('\n'),
          },
        ],
      };
    }
  );

  // Tool: Analyze Theme Setup
  server.registerTool(
    'analyze-theme-setup',
    {
      title: 'Analyze Theme and Styling Setup',
      description:
        'Analyzes theme configuration, dark mode setup, CSS frameworks, and styling patterns in the Next.js project.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project to analyze'),
      },
    },
    async ({ projectPath }: { projectPath: string }) => {
      const job = jobManager.createJob();
      jobManager.updateJobStatus(job.id, 'processing', 'Analyzing theme setup...', 10);

      try {
        const analyzer = new NextJSAnalyzer({
          projectRoot: projectPath,
          nextVersion: '',
          routerType: 'app',
          typescript: true,
          excludePatterns: [],
          includePatterns: [],
        });

        const report = await analyzer.analyze();

        const themeAnalysis =
          report.nextjsAnalysis?.packages.filter((pkg) =>
            [
              'next-themes',
              'tailwindcss',
              '@next/font',
              'next/font',
              'framer-motion',
              'styled-components',
            ].includes(pkg.name)
          ) || [];

        const result = {
          themePackages: themeAnalysis,
          patterns: report.nextjsAnalysis?.patterns || [],
          recommendations: themeAnalysis.flatMap((pkg) => pkg.recommendations),
          projectHealth: report.nextjsAnalysis?.projectHealth,
        };

        // Create a modified report with theme analysis results
        const themeReport = { ...report };
        if (themeReport.nextjsAnalysis) {
          themeReport.nextjsAnalysis = {
            ...themeReport.nextjsAnalysis,
            packages: themeAnalysis,
          };
        }

        jobManager.completeJob(job.id, themeReport);

        return {
          content: [
            {
              type: 'text',
              text:
                `Theme analysis completed!\n\n` +
                `Found ${themeAnalysis.length} theme-related packages\n` +
                `Health Score: ${report.nextjsAnalysis?.projectHealth?.score || 'N/A'}/100\n\n` +
                `Job ID: ${job.id} - Check results with get-analysis-report`,
            },
          ],
        };
      } catch (error) {
        jobManager.failJob(job.id, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  );

  // Tool: Audit SEO Setup
  server.registerTool(
    'audit-seo-setup',
    {
      title: 'Audit SEO Configuration',
      description:
        'Comprehensive SEO audit including metadata, sitemap, structured data, and social sharing setup.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project to analyze'),
      },
    },
    async ({ projectPath }: { projectPath: string }) => {
      const job = jobManager.createJob();
      jobManager.updateJobStatus(job.id, 'processing', 'Auditing SEO setup...', 10);

      try {
        const analyzer = new NextJSAnalyzer({
          projectRoot: projectPath,
          nextVersion: '',
          routerType: 'app',
          typescript: true,
          excludePatterns: [],
          includePatterns: [],
        });

        const report = await analyzer.analyze();

        const seoPackages =
          report.nextjsAnalysis?.packages.filter((pkg) =>
            ['next-seo', '@vercel/analytics', '@vercel/speed-insights'].includes(pkg.name)
          ) || [];

        const seoIssues =
          report.nextjsAnalysis?.setupIssues.filter((issue) => issue.category === 'seo') || [];

        const result = {
          seoPackages,
          seoIssues,
          recommendations: [
            ...seoPackages.flatMap((pkg) => pkg.recommendations),
            ...seoIssues.flatMap((issue) => issue.recommendations),
          ],
          projectHealth: report.nextjsAnalysis?.projectHealth,
        };

        // Create a modified report with SEO analysis results
        const seoReport = { ...report };
        if (seoReport.nextjsAnalysis) {
          seoReport.nextjsAnalysis = {
            ...seoReport.nextjsAnalysis,
            packages: seoPackages,
            setupIssues: seoIssues,
          };
        }

        jobManager.completeJob(job.id, seoReport);

        return {
          content: [
            {
              type: 'text',
              text:
                `SEO audit completed!\n\n` +
                `Found ${seoPackages.length} SEO-related packages\n` +
                `Identified ${seoIssues.length} SEO issues\n` +
                `Health Score: ${report.nextjsAnalysis?.projectHealth?.score || 'N/A'}/100\n\n` +
                `Job ID: ${job.id} - Check detailed results with get-analysis-report`,
            },
          ],
        };
      } catch (error) {
        jobManager.failJob(job.id, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  );

  // Tool: Scan Performance Issues
  server.registerTool(
    'scan-performance-issues',
    {
      title: 'Scan Performance Optimization Opportunities',
      description:
        'Identifies performance issues including unoptimized images, missing loading states, bundle size problems, and font optimization opportunities.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project to analyze'),
      },
    },
    async ({ projectPath }: { projectPath: string }) => {
      const job = jobManager.createJob();

      try {
        const analyzer = new NextJSAnalyzer({
          projectRoot: projectPath,
          nextVersion: '',
          routerType: 'app',
          typescript: true,
          excludePatterns: [],
          includePatterns: [],
        });

        const report = await analyzer.analyze();

        const perfPackages =
          report.nextjsAnalysis?.packages.filter((pkg) =>
            ['@next/bundle-analyzer', 'next/font', '@vercel/speed-insights'].includes(pkg.name)
          ) || [];

        const perfIssues =
          report.nextjsAnalysis?.setupIssues.filter((issue) => issue.category === 'performance') ||
          [];

        jobManager.completeJob(job.id, report);

        return {
          content: [
            {
              type: 'text',
              text:
                `Performance scan completed!\n\n` +
                `Found ${perfPackages.length} performance-related packages\n` +
                `Identified ${perfIssues.length} performance issues\n` +
                `Health Score: ${report.nextjsAnalysis?.projectHealth?.score || 'N/A'}/100\n\n` +
                `Job ID: ${job.id} - Check detailed results with get-analysis-report`,
            },
          ],
        };
      } catch (error) {
        jobManager.failJob(job.id, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  );

  // Tool: Check Accessibility
  server.registerTool(
    'check-accessibility',
    {
      title: 'Check Accessibility Compliance',
      description:
        'Scans for accessibility issues including missing alt tags, semantic HTML problems, and ARIA attribute issues.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project to analyze'),
      },
    },
    async ({ projectPath }: { projectPath: string }) => {
      const job = jobManager.createJob();

      try {
        const analyzer = new NextJSAnalyzer({
          projectRoot: projectPath,
          nextVersion: '',
          routerType: 'app',
          typescript: true,
          excludePatterns: [],
          includePatterns: [],
        });

        const report = await analyzer.analyze();

        const accessibilityIssues =
          report.nextjsAnalysis?.setupIssues.filter(
            (issue) => issue.category === 'accessibility'
          ) || [];

        jobManager.completeJob(job.id, report);

        return {
          content: [
            {
              type: 'text',
              text:
                `Accessibility check completed!\n\n` +
                `Identified ${accessibilityIssues.length} accessibility issues\n` +
                `Health Score: ${report.nextjsAnalysis?.projectHealth?.score || 'N/A'}/100\n\n` +
                `Job ID: ${job.id} - Check detailed results with get-analysis-report`,
            },
          ],
        };
      } catch (error) {
        jobManager.failJob(job.id, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  );

  // Tool: Detect Next.js Patterns
  server.registerTool(
    'detect-nextjs-patterns',
    {
      title: 'Detect Advanced Next.js Routing Patterns',
      description:
        'Identifies advanced Next.js routing patterns including route groups, private folders, intercepting routes, parallel routes, and dynamic route segments.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project to analyze'),
      },
    },
    async ({ projectPath }: { projectPath: string }) => {
      const job = jobManager.createJob();

      try {
        const analyzer = new NextJSAnalyzer({
          projectRoot: projectPath,
          nextVersion: '',
          routerType: 'app',
          typescript: true,
          excludePatterns: [],
          includePatterns: [],
        });

        const report = await analyzer.analyze();

        const patterns = report.nextjsAnalysis?.patterns || [];

        const patternsByType = patterns.reduce(
          (acc, pattern) => {
            acc[pattern.type] = acc[pattern.type] || [];
            acc[pattern.type].push(pattern);
            return acc;
          },
          {} as Record<string, typeof patterns>
        );

        jobManager.completeJob(job.id, report);

        return {
          content: [
            {
              type: 'text',
              text:
                `Next.js patterns detection completed!\n\n` +
                `Found ${patterns.length} advanced routing patterns:\n` +
                Object.entries(patternsByType)
                  .map(([type, items]) => `• ${type}: ${items.length} instances`)
                  .join('\n') +
                '\n\n' +
                `Health Score: ${report.nextjsAnalysis?.projectHealth?.score || 'N/A'}/100\n\n` +
                `Job ID: ${job.id} - Check detailed results with get-analysis-report`,
            },
          ],
        };
      } catch (error) {
        jobManager.failJob(job.id, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  );

  // Tool: Validate Project Health
  server.registerTool(
    'validate-project-health',
    {
      title: 'Generate Comprehensive Project Health Report',
      description:
        'Provides an overall project health score with detailed analysis of strengths, areas for improvement, package configuration status, and actionable recommendations.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project to analyze'),
        includeRecommendations: z
          .boolean()
          .optional()
          .describe('Include detailed recommendations (default: true)'),
      },
    },
    async ({
      projectPath,
      includeRecommendations = true,
    }: {
      projectPath: string;
      includeRecommendations?: boolean;
    }) => {
      const job = jobManager.createJob();

      try {
        const analyzer = new NextJSAnalyzer({
          projectRoot: projectPath,
          nextVersion: '',
          routerType: 'app',
          typescript: true,
          excludePatterns: [],
          includePatterns: [],
        });

        const report = await analyzer.analyze();

        const healthData = report.nextjsAnalysis?.projectHealth || {
          score: 0,
          strengths: [],
          improvements: [],
        };

        jobManager.completeJob(job.id, report);

        const scoreEmoji = healthData.score >= 80 ? '🟢' : healthData.score >= 60 ? '🟡' : '🔴';

        return {
          content: [
            {
              type: 'text',
              text:
                `Project health report generated! ${scoreEmoji}\n\n` +
                `Overall Health Score: ${healthData.score}/100\n\n` +
                `Strengths (${healthData.strengths.length}):\n` +
                healthData.strengths.map((s) => `• ${s}`).join('\n') +
                '\n\n' +
                `Areas for Improvement (${healthData.improvements.length}):\n` +
                healthData.improvements.map((i) => `• ${i}`).join('\n') +
                '\n\n' +
                `Job ID: ${job.id} - Check detailed results with get-analysis-report`,
            },
          ],
        };
      } catch (error) {
        jobManager.failJob(job.id, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  );

  return server;
}

/**
 * Start MCP server with stdio transport (for CLI usage)
 */
export async function startMCPServerStdio(): Promise<void> {
  const server = createMCPServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  // Note: No console output for stdio transport as it interferes with MCP communication
}

/**
 * Start MCP server with HTTP transport following v2025-03-26 standards
 * Supports modern Streamable HTTP and legacy SSE for backwards compatibility
 */
export function startMCPServerHTTP(port: number): void {
  console.log(chalk.blue('🚀 Starting MCP HTTP Server with v2025-03-26 standards...'));

  const app = express();
  app.use(express.json());

  // Add CORS middleware for browser client support
  app.use(
    cors({
      origin:
        process.env.NODE_ENV === 'production'
          ? ['https://claude.ai', 'https://app.anthropic.com'] // Configure for production
          : '*', // Allow all origins in development
      exposedHeaders: ['Mcp-Session-Id'], // Required for session management
      allowedHeaders: ['Content-Type', 'mcp-session-id'],
      credentials: true,
    })
  );

  // Store transports for each session type (backwards compatibility)
  const transports = {
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>,
  };

  // Modern Streamable HTTP endpoint (v2025-03-26)
  app.all('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.streamable[sessionId]) {
        // Reuse existing transport for established session
        transport = transports.streamable[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request - create transport with modern security
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            transports.streamable[sessionId] = transport;
          },
          // Enable security features for production
          enableDnsRebindingProtection: process.env.NODE_ENV === 'production',
          allowedHosts:
            process.env.NODE_ENV === 'production' ? ['127.0.0.1', 'localhost'] : undefined,
          allowedOrigins:
            process.env.NODE_ENV === 'production'
              ? ['https://claude.ai', 'https://app.anthropic.com']
              : undefined,
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports.streamable[transport.sessionId];
          }
        };

        const server = createMCPServer();
        await server.connect(transport);
      } else {
        // Invalid session ID
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Invalid session',
          },
          id: null,
        });
        return;
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('HTTP MCP Server Error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  });

  // Legacy SSE endpoint for backwards compatibility with older clients
  app.get('/sse', async (req, res) => {
    try {
      console.log(chalk.yellow('📡 Legacy SSE client connecting (deprecated)'));

      const transport = new SSEServerTransport('/messages', res);
      transports.sse[transport.sessionId] = transport;

      res.on('close', () => {
        delete transports.sse[transport.sessionId];
      });

      const server = createMCPServer();
      await server.connect(transport);
    } catch (error) {
      console.error('SSE MCP Server Error:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Legacy message endpoint for older clients
  app.post('/messages', async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string;
      const transport = transports.sse[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    } catch (error) {
      console.error('SSE Message Handler Error:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Reusable handler for GET and DELETE requests on modern endpoint
  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.streamable[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports.streamable[sessionId];
    await transport.handleRequest(req, res);
  };

  // Handle GET requests for server-to-client notifications via SSE on modern endpoint
  app.get('/mcp', handleSessionRequest);

  // Handle DELETE requests for session termination on modern endpoint
  app.delete('/mcp', async (req, res) => {
    try {
      await handleSessionRequest(req, res);

      // Clean up the session
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && transports.streamable[sessionId]) {
        delete transports.streamable[sessionId];
      }
    } catch (error) {
      console.error('HTTP MCP Server Error (DELETE):', error);
      res.status(500).send('Internal server error');
    }
  });

  app.listen(port, 'localhost', () => {
    console.log(chalk.green(`✅ MCP Server running on http://localhost:${port}`));
    console.log(chalk.blue(`🔗 Modern endpoint: http://localhost:${port}/mcp`));
    console.log(chalk.yellow(`🔗 Legacy endpoint: http://localhost:${port}/sse`));
    console.log(chalk.cyan(`📋 Protocol: v2025-03-26 with backwards compatibility`));
    console.log(
      chalk.magenta(
        `🛡️  Security: ${process.env.NODE_ENV === 'production' ? 'Enabled (DNS rebinding protection)' : 'Development mode'}`
      )
    );
    console.log(chalk.green(`🌐 CORS: Enabled for browser clients`));
  });
}

/**
 * Legacy function to maintain backwards compatibility
 */
export function startMCPServer(port: number): void {
  startMCPServerHTTP(port);
}
