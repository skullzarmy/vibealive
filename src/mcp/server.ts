// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import chalk from 'chalk';
import express from 'express';
import { randomUUID } from 'crypto';
import { JobManager } from './job-manager';
import { NextJSAnalyzer } from '../analyzer';
import { AnalysisConfig } from '../types';

const jobManager = new JobManager();

/**
 * Creates a new MCP server instance with all the necessary tools and resources
 */
function createMCPServer(): McpServer {
  const server = new McpServer({
    name: 'vibealive',
    version: '1.1.0',
  });

  // Tool: Analyze Next.js project
  server.registerTool(
    'analyze-project',
    {
      title: 'Analyze Next.js Project',
      description: 'Initiates a full, asynchronous analysis of a Next.js project to identify unused code, dead components, and redundant API endpoints.',
      inputSchema: {
        projectPath: z.string().describe('Path to the Next.js project to analyze'),
        options: z.object({
          exclude: z.array(z.string()).optional().describe('Glob patterns to exclude from analysis'),
          include: z.array(z.string()).optional().describe('Glob patterns to include in analysis'),
          confidenceThreshold: z.number().min(0).max(100).optional().describe('Minimum confidence threshold for findings (0-100)'),
          generateGraph: z.boolean().optional().describe('Whether to generate dependency graph'),
          plugins: z.array(z.string()).optional().describe('Additional analysis plugins to run'),
          verbose: z.boolean().optional().describe('Enable verbose output'),
        }).optional().describe('Analysis configuration options'),
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
              ...options 
            };
            
            const analyzer = new NextJSAnalyzer(config);
            const report = await analyzer.analyze();
            jobManager.completeJob(job.id, report);
          } catch (e: any) {
            jobManager.failJob(job.id, e.message);
          }
        })();

        return {
          content: [{
            type: 'text' as const,
            text: `Analysis started for project: ${projectPath}\nJob ID: ${job.id}\nStatus: ${job.status}\n\nUse the get-job-status tool to check progress.`,
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error starting analysis: ${error.message}`,
          }],
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
            content: [{
              type: 'text' as const,
              text: `Job not found: ${jobId}`,
            }],
            isError: true,
          };
        }

        let statusText = `Job ID: ${job.id}\nStatus: ${job.status}\nProgress: ${job.progress}%\nMessage: ${job.message}`;
        
        if (job.error) {
          statusText += `\nError: ${job.error}`;
        }

        return {
          content: [{
            type: 'text' as const,
            text: statusText,
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error getting job status: ${error.message}`,
          }],
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
        format: z.enum(['json', 'summary']).optional().describe('Report format - full JSON or summary'),
      },
    },
    async ({ jobId, format = 'summary' }) => {
      try {
        const job = jobManager.getJob(jobId);
        if (!job) {
          return {
            content: [{
              type: 'text' as const,
              text: `Job not found: ${jobId}`,
            }],
            isError: true,
          };
        }

        if (job.status !== 'completed' || !job.result) {
          return {
            content: [{
              type: 'text' as const,
              text: `Job is not completed or has no result. Status: ${job.status}`,
            }],
            isError: true,
          };
        }

        if (format === 'json') {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(job.result, null, 2),
            }],
          };
        } else {
          // Generate a summary
          const report = job.result;
          const summary = `
Analysis Report for ${report.metadata.projectRoot}

Summary:
- Total files analyzed: ${report.files.length}
- Unused files: ${report.files.filter(f => f.classification === 'UNUSED').length}
- Auto-invoked files: ${report.files.filter(f => f.classification === 'AUTO_INVOKED').length}
- Active files: ${report.files.filter(f => f.classification === 'ACTIVE').length}
- Dead code files: ${report.files.filter(f => f.classification === 'DEAD_CODE').length}

Analysis Date: ${report.metadata.analysisDate}

Top Issues:
${report.recommendations.slice(0, 5).map(r => `- ${r.type}: ${r.description}`).join('\n')}

Use format="json" for the full detailed report.
          `;

          return {
            content: [{
              type: 'text' as const,
              text: summary.trim(),
            }],
          };
        }
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error getting analysis report: ${error.message}`,
          }],
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
            content: [{
              type: 'text' as const,
              text: `Job not found or not completed: ${jobId}`,
            }],
            isError: true,
          };
        }

        const fileAnalysis = job.result.files.find(f => f.path === filePath);
        if (!fileAnalysis) {
          return {
            content: [{
              type: 'text' as const,
              text: `File not found in analysis: ${filePath}`,
            }],
            isError: true,
          };
        }

        const details = `
File: ${fileAnalysis.path}
Classification: ${fileAnalysis.classification}
Confidence: ${fileAnalysis.confidence}%

Reasons:
${fileAnalysis.reasons.map(r => `- ${r}`).join('\n')}

Export Count: ${fileAnalysis.exportCount}
Import Count: ${fileAnalysis.importCount}
Usage Locations: ${fileAnalysis.usageLocations.length}

${fileAnalysis.bundleSize ? `Bundle Size: ${fileAnalysis.bundleSize} bytes` : ''}
        `;

        return {
          content: [{
            type: 'text' as const,
            text: details.trim(),
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error getting file details: ${error.message}`,
          }],
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
      contents: [{
        uri: 'status://server',
        text: JSON.stringify({
          status: 'running',
          version: '1.1.0',
          activeJobs: Array.from(jobManager['jobs'].values()).filter(j => j.status === 'processing').length,
          totalJobs: jobManager['jobs'].size,
        }, null, 2),
      }],
    })
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
  console.error(chalk.green('✅ MCP Server running with stdio transport'));
}

/**
 * Start MCP server with HTTP transport (for remote access)
 */
export function startMCPServerHTTP(port: number): void {
  const app = express();
  app.use(express.json());

  // Map to store transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // Handle POST requests for client-to-server communication
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId) {
      // New session
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          transports[sessionId] = transport;
        },
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      const server = createMCPServer();
      await server.connect(transport);
    } else {
      // Invalid request
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
  });

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  app.listen(port, 'localhost', () => {
    console.log(chalk.green(`✅ MCP Server running on http://localhost:${port}`));
  });
}

/**
 * Legacy function to maintain backwards compatibility
 */
export function startMCPServer(port: number): void {
  startMCPServerHTTP(port);
}
