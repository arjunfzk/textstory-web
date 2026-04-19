/**
 * GET /api/upload/[sessionId]/[filename] — serves uploaded images by session and filename.
 *
 * Supports both profile photos (photo.jpg) and message images (image.jpg).
 * In production, Nginx serves these directly from /tmp/textstory/uploads/.
 * This route is a dev-only fallback so images display during development.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = '/tmp/textstory/uploads';

// Only allow safe filenames to prevent path traversal attacks
const ALLOWED_FILENAMES = new Set(['photo.jpg', 'image.jpg']);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; filename: string }> },
) {
  try {
    const { sessionId, filename } = await params;

    // Validate sessionId is a UUID (positive allowlist — replaces path traversal check)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    if (!ALLOWED_FILENAMES.has(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = join(UPLOAD_DIR, sessionId, filename);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
}
