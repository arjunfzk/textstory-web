/**
 * POST /api/upload — profile photo upload endpoint.
 *
 * Accepts multipart/form-data with a single 'file' field.
 * Processes the image with Sharp: EXIF correction + resize to 200x200.
 * Saves to /tmp/textstory/uploads/{uuid}/photo.jpg.
 * Returns { url: "/api/upload/{uuid}/photo.jpg" } for client display.
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = '/tmp/textstory/uploads';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const OUTPUT_SIZE = 200;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, and WebP images are allowed' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Image must be under 2MB' },
        { status: 400 },
      );
    }

    const sessionId = crypto.randomUUID();
    const sessionDir = join(UPLOAD_DIR, sessionId);
    await mkdir(sessionDir, { recursive: true });

    // Process with Sharp: validate dimensions, rotate per EXIF, resize, output JPEG
    const buffer = Buffer.from(await file.arrayBuffer());
    const outputPath = join(sessionDir, 'photo.jpg');

    // Limit decode cost — reject images with extreme pixel counts
    const metadata = await sharp(buffer).metadata();
    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
    if (pixels > 25_000_000) {
      return NextResponse.json(
        { error: 'Image dimensions too large (max ~5000x5000)' },
        { status: 400 },
      );
    }

    await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    // Return a URL that the client can use to display the image.
    // In production, Nginx serves /uploads/ from /tmp/textstory/uploads/.
    // In dev, we serve it through a Next.js API route.
    const url = `/api/upload/${sessionId}/photo.jpg`;

    return NextResponse.json({ url });
  } catch (err) {
    console.error('Upload failed:', err);
    return NextResponse.json(
      { error: 'Upload processing failed' },
      { status: 500 },
    );
  }
}
