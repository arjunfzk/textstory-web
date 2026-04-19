/**
 * GET /exports/[filename] — serves exported video files.
 *
 * In production, Nginx serves these directly from /tmp/textstory/exports/.
 * This route exists for dev mode where Nginx is not running.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

const EXPORTS_DIR = '/tmp/textstory/exports';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Sanitize: only allow alphanumeric + hyphens + .mp4
  if (!/^[\w-]+\.mp4$/.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(EXPORTS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size.toString(),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
