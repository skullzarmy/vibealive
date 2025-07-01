// src/mcp/job-manager.ts
import { randomBytes } from 'crypto';
import { Job, JobStatus, AnalysisReport } from '../types';

export class JobManager {
  private jobs: Map<string, Job> = new Map();

  public createJob(): Job {
    const id = randomBytes(16).toString('hex');
    const job: Job = {
      id,
      status: 'queued',
      progress: 0,
      message: 'Analysis job is queued.',
    };
    this.jobs.set(id, job);
    return job;
  }

  public getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  public updateJobStatus(id: string, status: JobStatus, message: string, progress?: number): void {
    const job = this.getJob(id);
    if (job) {
      job.status = status;
      job.message = message;
      if (progress !== undefined) {
        job.progress = progress;
      }
      this.jobs.set(id, job);
    }
  }

  public completeJob(id: string, report: AnalysisReport): void {
    const job = this.getJob(id);
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.message = 'Analysis complete.';
      job.result = report;
      this.jobs.set(id, job);
    }
  }

  public failJob(id: string, error: string): void {
    const job = this.getJob(id);
    if (job) {
      job.status = 'failed';
      job.message = 'Analysis failed.';
      job.error = error;
      this.jobs.set(id, job);
    }
  }
}
