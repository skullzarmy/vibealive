// src/mcp/legacy.ts
// Legacy compatibility shim for old MCP API
import express, { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';
import { JobManager } from './job-manager';
import { NextJSAnalyzer } from '../analyzer';
import { AnalysisConfig } from '../types';
import { mcpSchema } from './schema';

const jobManager = new JobManager();

interface LegacyMcpRequestBody {
  mcp_version: string;
  method: string;
  params: any;
}

/**
 * Legacy MCP server implementation for backwards compatibility
 * @deprecated Use the new MCP SDK-based server instead
 */
export function startLegacyMCPServer(port: number): void {
  console.warn(chalk.yellow('⚠️  Using legacy MCP server. Consider migrating to the new SDK-based implementation.'));
  
  const app = express();
  app.use(express.json());

  // Legacy method handlers
  async function handleAnalyze(req: Request<{}, {}, LegacyMcpRequestBody>, res: Response, next: NextFunction) {
    try {
      const { projectPath, options } = req.body.params;
      if (!projectPath) {
        return res.status(400).json({
          mcp_version: '1.0',
          error: { code: -32602, message: 'Invalid params: missing projectPath' },
        });
      }

      const job = jobManager.createJob();
      res.status(202).json({ mcp_version: '1.0', result: job });

      // Run analysis in the background
      (async () => {
        try {
          jobManager.updateJobStatus(job.id, 'processing', 'Starting analysis...');
          const config: AnalysisConfig = { 
            projectRoot: projectPath,
            nextVersion: 'auto-detect',
            routerType: 'hybrid',
            typescript: true,
            excludePatterns: options?.exclude || [],
            includePatterns: options?.include || [],
            ...options 
          };
          const analyzer = new NextJSAnalyzer(config);
          const report = await analyzer.analyze();
          jobManager.completeJob(job.id, report);
        } catch (e: any) {
          jobManager.failJob(job.id, e.message);
        }
      })();
    } catch (error) {
      next(error);
    }
  }

  async function handleStatus(req: Request<{}, {}, LegacyMcpRequestBody>, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.body.params;
      if (!jobId) {
        return res.status(400).json({
          mcp_version: '1.0',
          error: { code: -32602, message: 'Invalid params: missing jobId' },
        });
      }
      const job = jobManager.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          mcp_version: '1.0',
          error: { code: -32603, message: `Job not found: ${jobId}` },
        });
      }
      return res.json({ mcp_version: '1.0', result: job });
    } catch (error) {
      next(error);
    }
  }

  async function handleGetReport(req: Request<{}, {}, LegacyMcpRequestBody>, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.body.params;
      if (!jobId) {
        return res.status(400).json({
          mcp_version: '1.0',
          error: { code: -32602, message: 'Invalid params: missing jobId' },
        });
      }
      const job = jobManager.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          mcp_version: '1.0',
          error: { code: -32603, message: `Job not found: ${jobId}` },
        });
      }
      if (job.status !== 'completed' || !job.result) {
        return res.status(400).json({
          mcp_version: '1.0',
          error: { code: -32603, message: `Job not complete or no result: ${jobId}` },
        });
      }
      return res.json({ mcp_version: '1.0', result: job.result });
    } catch (error) {
      next(error);
    }
  }

  async function handleDiscover(req: Request, res: Response, next: NextFunction) {
    try {
      return res.json({ mcp_version: '1.0', result: mcpSchema });
    } catch (error) {
      next(error);
    }
  }

  async function handleServerStatus(req: Request, res: Response, next: NextFunction) {
    try {
      return res.json({ mcp_version: '1.0', result: { status: 'ok' } });
    } catch (error) {
      next(error);
    }
  }

  // Main router
  app.post('/', async (req: any, res: any, next: any) => {
    try {
      const { method } = req.body as LegacyMcpRequestBody;
      switch (method) {
        case 'mcp.discover':
          return await handleDiscover(req, res, next);
        case 'mcp.status':
          if (req.body.params && req.body.params.jobId) {
            return await handleStatus(req, res, next);
          }
          return await handleServerStatus(req, res, next);
        case 'mcp.analyze':
          return await handleAnalyze(req, res, next);
        case 'mcp.getReport':
          return await handleGetReport(req, res, next);
        default:
          res.status(501).json({
            mcp_version: '1.0',
            error: { code: -32601, message: `Method not found: ${method}` },
          });
          return;
      }
    } catch (error) {
      next(error);
    }
  });

  // Error handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error(chalk.red('Legacy MCP Server Error:'), err);
    res.status(500).json({
      mcp_version: '1.0',
      error: {
        code: -32603,
        message: 'Internal server error',
        data: { details: err.message },
      },
    });
  });

  app.listen(port, 'localhost', () => {
    console.log(chalk.yellow(`⚠️  Legacy MCP Server running on http://localhost:${port}`));
    console.log(chalk.blue('💡 Consider migrating to: npx vibealive serve --port ' + port));
  });
}