/**
 * GET /api/export/[jobId] — polls export job status.
 *
 * Returns the current ExportJob state. Clients poll this endpoint
 * every ~1 second until status is 'complete' or 'error'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jobStore } from '@/lib/job-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = jobStore.get(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
