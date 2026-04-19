/**
 * GET /exports/[filename] — serves exported video files in dev mode.
 *
 * In production, Nginx serves these directly from /tmp/textstory/exports/.
 * This route exists only for development where Nginx is not running.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
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

  try {
    const fileStat = await stat(filePath);
    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': fileStat.size.toString(),
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
