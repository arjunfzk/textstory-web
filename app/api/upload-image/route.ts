/**
 * POST /api/upload-image — message image upload endpoint.
 *
 * Unlike /api/upload (profile photos, 200x200 square crop), this endpoint
 * preserves aspect ratio and returns original dimensions for layout.
 * Max dimension: 800px on longest side.
 * Saves to /tmp/textstory/uploads/{uuid}/image.jpg.
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = '/tmp/textstory/uploads';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (larger than profile photos)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIMENSION = 800;

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
        { error: 'Image must be under 5MB' },
        { status: 400 },
      );
    }

    const sessionId = crypto.randomUUID();
    const sessionDir = join(UPLOAD_DIR, sessionId);
    await mkdir(sessionDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate pixel count to prevent decompression bomb attacks
    const metadata = await sharp(buffer).metadata();
    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
    if (pixels > 25_000_000) {
      return NextResponse.json(
        { error: 'Image dimensions too large (max ~5000x5000)' },
        { status: 400 },
      );
    }

    const outputPath = join(sessionDir, 'image.jpg');

    // Resize preserving aspect ratio — fit inside MAX_DIMENSION box
    const resized = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation metadata
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    const url = `/api/upload/${sessionId}/image.jpg`;

    return NextResponse.json({
      url,
      width: resized.width,
      height: resized.height,
    });
  } catch (err) {
    console.error('Image upload failed:', err);
    return NextResponse.json(
      { error: 'Image upload processing failed' },
      { status: 500 },
    );
  }
}
