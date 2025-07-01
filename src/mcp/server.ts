// src/mcp/server.ts
import express, { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';
import { JobManager } from './job-manager';
import { NextJSAnalyzer } from '../analyzer';
import { AnalysisConfig } from '../types';
import { mcpSchema } from './schema';

// --- MCP Request Body Type ---
interface McpRequestBody {
  mcp_version: string;
  method: string;
  params: any;
}

const jobManager = new JobManager();

// --- Method Handlers ---

async function handleAnalyze(
  req: Request<{}, {}, McpRequestBody>,
  res: Response,
  next: NextFunction
) {
  try {
    const { projectPath, options } = req.body.params;
    if (!projectPath) {
      return res.status(400).json({
        mcp_version: '1.0',
        error: { code: -32602, message: 'Invalid params: missing projectPath' },
      });
    }

    const job = jobManager.createJob();
    res.status(202).json({ mcp_version: '1.0', result: job }); // Respond immediately

    // Run analysis in the background
    (async () => {
      try {
        jobManager.updateJobStatus(job.id, 'processing', 'Starting analysis...');
        const config: AnalysisConfig = { projectRoot: projectPath, ...options };
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

async function handleStatus(
  req: Request<{}, {}, McpRequestBody>,
  res: Response,
  next: NextFunction
) {
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

async function handleGetReport(
  req: Request<{}, {}, McpRequestBody>,
  res: Response,
  next: NextFunction
) {
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
      return res
        .status(404)
        .json({ mcp_version: '1.0', error: { code: -32603, message: `Job not found: ${jobId}` } });
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

async function handleHelp(req: any, res: any, next: any) {
  try {
    const { method } = req.body.params;
    const methodSchema = mcpSchema.methods.find((m) => m.name === method);
    if (!methodSchema) {
      return res.status(404).json({
        mcp_version: '1.0',
        error: { code: -32601, message: `Help not found for method: ${method}` },
      });
    }
    // Format a human-readable help string
    const helpText = `
Method: ${methodSchema.name}
Description: ${methodSchema.description}
Parameters:
${methodSchema.params.map((p: any) => `  - ${p.name} (${p.type}): ${p.required ? 'Required' : 'Optional'}. ${p.description || ''}`).join('\n')}
Returns: ${methodSchema.returns.type} - ${methodSchema.returns.description}
    `;
    return res.json({ mcp_version: '1.0', result: helpText.trim() });
  } catch (error) {
    next(error);
  }
}

// --- Main Server Function ---

export function startMCPServer(port: number) {
  const app = express();
  const router = express.Router();

  app.use(express.json());

  // --- MCP Router ---
  app.post('/', async (req: any, res: any, next: any) => {
    try {
      const { method } = req.body as McpRequestBody;
      switch (method) {
        case 'mcp.discover':
          return await handleDiscover(req, res, next);
        case 'mcp.status':
          // Differentiate between server status and job status
          if (req.body.params && req.body.params.jobId) {
            return await handleStatus(req, res, next);
          }
          return await handleServerStatus(req, res, next);
        case 'mcp.help':
          return await handleHelp(req, res, next);
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

  app.use('/', router);

  // --- Centralized Error Handler ---
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(chalk.red('MCP Server Error:'), err);
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
    console.log(chalk.green(`✅ MCP Server running on http://localhost:${port}`));
  });
}
