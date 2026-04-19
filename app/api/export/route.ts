/**
 * POST /api/export — starts an async video export job.
 *
 * Accepts a conversation snapshot, validates it, starts the video
 * pipeline in the background, and returns a jobId for status polling.
 *
 * The conversation is deep-copied at submit time (structuredClone)
 * to prevent mutation during async processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jobStore } from '@/lib/job-store';
import { runExportPipeline } from '@/lib/video-pipeline';

/** Max messages per export (V1 limit). */
const MAX_MESSAGES = 50;

/** Discriminated union schema for individual messages (text or image). */
const messageSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('text'),
    text: z.string().min(1, 'Message text cannot be empty').max(2000, 'Message text too long'),
    sender: z.enum(['you', 'friend']),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('image'),
    imageUrl: z.string().startsWith('/api/upload/', 'Image URL must be an internal upload path'),
    sender: z.enum(['you', 'friend']),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }),
]);

/** Input validation schema for the export request. */
const conversationSchema = z.object({
  conversation: z.object({
    messages: z
      .array(messageSchema)
      .min(1, 'At least one message is required')
      .max(MAX_MESSAGES, `Max ${MAX_MESSAGES} messages per export`),
    contact: z.object({
      name: z.string().min(1, 'Contact name is required').max(30),
      profileImageUrl: z.string().startsWith('/api/upload/').optional(),
    }),
    style: z.enum(['imessage', 'whatsapp', 'instagram']),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = conversationSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Validation failed';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { conversation } = parsed.data;

  // Snapshot isolation — deep-copy to prevent mutation during async processing
  const snapshot = structuredClone(conversation);

  const jobId = crypto.randomUUID();
  jobStore.set(jobId, { id: jobId, status: 'queued', progress: 0 });

  // Fire and forget — pipeline updates job status as it progresses
  runExportPipeline({
    conversation: snapshot,
    jobId,
    onProgress: (status, progress) => {
      if (status === 'complete' || status === 'error') {
        // Terminal states handled in .then() / .catch() below
        return;
      }
      jobStore.set(jobId, { id: jobId, status, progress });
    },
  })
    .then((downloadUrl) => {
      jobStore.set(jobId, { id: jobId, status: 'complete', progress: 100, downloadUrl });
    })
    .catch((error: Error) => {
      jobStore.set(jobId, {
        id: jobId,
        status: 'error',
        progress: 0,
        error: error.message,
      });
    });

  return NextResponse.json({ jobId });
}
