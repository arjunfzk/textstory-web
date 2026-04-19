/**
 * In-memory job store for tracking export job status.
 *
 * V1: simple Map — concurrency=1 and jobs are ephemeral.
 * V2: swap for Redis by implementing the same get/set interface.
 *
 * Completed and errored jobs auto-expire after 1 hour to prevent
 * unbounded memory growth.
 */

import type { ExportJob } from '@/lib/types';

const jobs = new Map<string, ExportJob>();

/** TTL for completed/errored jobs (1 hour). */
const JOB_TTL_MS = 60 * 60 * 1000;

export const jobStore = {
  get(id: string): ExportJob | undefined {
    return jobs.get(id);
  },

  set(id: string, job: ExportJob): void {
    jobs.set(id, job);

    // Auto-expire terminal states
    if (job.status === 'complete' || job.status === 'error') {
      setTimeout(() => jobs.delete(id), JOB_TTL_MS);
    }
  },

  delete(id: string): void {
    jobs.delete(id);
  },
};
