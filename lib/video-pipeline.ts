/**
 * Video export pipeline — orchestrates Puppeteer + AudioPreMixer + FFmpeg.
 *
 * Pipeline stages:
 *   1. Compile timeline from conversation
 *   2. Launch Puppeteer, navigate to /render
 *   3. For each unique visual state: set frame → wait for paint → screenshot
 *   4. Pre-mix audio into single WAV
 *   5. Generate FFmpeg concat file (frame path + duration)
 *   6. FFmpeg: concat demuxer → H.264 + AAC → MP4
 *   7. Cleanup temp files
 *
 * Frame deduplication: only screenshot when the visual state changes.
 * Hold frames (breathing, read pause) reuse the same PNG via the concat
 * demuxer's duration metadata — no duplicate screenshots needed.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import type { Conversation, ExportStatus, TimelineEntry } from '@/lib/types';
import { compileTimeline, totalFrames, videoDuration, TIMELINE } from '@/lib/timeline-compiler';
import { loadSoundAssets, mixAudio } from '@/lib/audio-premixer';
import { Semaphore } from '@/lib/semaphore';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Only one export at a time for V1. */
const exportSemaphore = new Semaphore(1);

/** Directory containing pre-converted 48kHz WAV sound assets. */
const SOUND_DIR = path.join(process.cwd(), 'public', 'sounds');

/** Cached sound assets — loaded once, reused across exports. */
let cachedAssets: Awaited<ReturnType<typeof loadSoundAssets>> | null = null;
async function getCachedSoundAssets() {
  if (!cachedAssets) {
    cachedAssets = await loadSoundAssets(SOUND_DIR);
  }
  return cachedAssets;
}

/** Timeout for a single Puppeteer screenshot (10 seconds). */
const SCREENSHOT_TIMEOUT_MS = 10_000;

/** FFmpeg encoding timeout (2 minutes). */
const FFMPEG_TIMEOUT_MS = 2 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  conversation: Conversation;
  jobId: string;
  onProgress: (status: ExportStatus, progress: number) => void;
}

/**
 * Runs the full video export pipeline.
 * Returns the download URL path (e.g. "/exports/{jobId}.mp4").
 *
 * Acquires the export semaphore before starting. If another export is
 * already running, waits up to 30 seconds before rejecting.
 */
export async function runExportPipeline(options: PipelineOptions): Promise<string> {
  const acquired = await exportSemaphore.acquire(30_000);
  if (!acquired) {
    throw new Error('Export queue full — another video is being generated. Try again shortly.');
  }

  try {
    return await runPipelineInternal(options);
  } finally {
    exportSemaphore.release();
  }
}

// ---------------------------------------------------------------------------
// Pipeline internals
// ---------------------------------------------------------------------------

async function runPipelineInternal({
  conversation,
  jobId,
  onProgress,
}: PipelineOptions): Promise<string> {
  const workDir = path.join('/tmp/textstory/jobs', jobId);
  const exportsDir = '/tmp/textstory/exports';
  await fs.mkdir(workDir, { recursive: true });
  await fs.mkdir(exportsDir, { recursive: true });

  // Step 1: Compile timeline
  onProgress('compiling', 5);
  const timeline = compileTimeline(conversation);
  const frameCount = totalFrames(timeline);
  const duration = videoDuration(timeline);

  // Step 2: Capture frames with Puppeteer
  onProgress('rendering', 10);
  const framePaths = await captureFrames(timeline, conversation, workDir, (pct) => {
    onProgress('rendering', 10 + Math.round(pct * 60)); // 10-70%
  });

  // Step 3: Pre-mix audio (assets cached after first load)
  onProgress('encoding', 72);
  const audioPath = path.join(workDir, 'audio.wav');
  const assets = await getCachedSoundAssets();
  const wavBuffer = mixAudio(timeline, assets);
  await fs.writeFile(audioPath, wavBuffer);

  // Step 4: Generate concat file
  onProgress('encoding', 75);
  const concatPath = await generateConcatFile(timeline, framePaths, workDir);

  // Step 5: FFmpeg mux
  onProgress('encoding', 78);
  const outputPath = path.join(exportsDir, `${jobId}.mp4`);
  await ffmpegMux(concatPath, audioPath, outputPath, duration, (pct) => {
    onProgress('encoding', 78 + Math.round(pct * 20)); // 78-98%
  });

  // Step 6: Cleanup work directory (keep the output MP4)
  await fs.rm(workDir, { recursive: true, force: true });
  onProgress('complete', 100);

  return `/exports/${jobId}.mp4`;
}

// ---------------------------------------------------------------------------
// Frame capture
// ---------------------------------------------------------------------------

/**
 * Captures unique visual frames using Puppeteer.
 *
 * Only screenshots when the visual state changes — hold frames reuse
 * the same PNG via the concat demuxer's duration metadata.
 */
async function captureFrames(
  timeline: TimelineEntry[],
  conversation: Conversation,
  workDir: string,
  onProgress: (pct: number) => void,
): Promise<Map<string, string>> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });

    // Inject conversation data before page load
    await page.evaluateOnNewDocument((data: Conversation) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Puppeteer bridge
      (window as any).__TEXTSTORY_DATA__ = data;
    }, conversation);

    // Navigate to render page
    await page.goto('http://localhost:3000/render', {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    });

    // Wait for page to signal ready
    await page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Puppeteer bridge
      () => (window as any).__READY__ === true,
      { timeout: SCREENSHOT_TIMEOUT_MS },
    );

    // Deduplicate: group consecutive entries with the same visual ID
    const uniqueEntries = deduplicateVisualStates(timeline);
    const framePaths = new Map<string, string>();
    let screenshotIndex = 0;

    for (let i = 0; i < uniqueEntries.length; i++) {
      const entry = uniqueEntries[i];

      // Set the frame state
      await page.evaluate((e: TimelineEntry) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Puppeteer bridge
        const setFrame = (window as any).__setFrame;
        if (typeof setFrame === 'function') setFrame(e);
      }, entry);

      // Wait for React to render and signal completion via double-rAF
      await page.waitForFunction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Puppeteer bridge
        (expectedId: string) => (window as any).__RENDERED_FRAME_ID__ === expectedId,
        { timeout: SCREENSHOT_TIMEOUT_MS },
        entry.id,
      );

      // Screenshot the capture root
      const filePath = path.join(
        workDir,
        `frame_${String(screenshotIndex).padStart(5, '0')}.png`,
      );

      const captureRoot = await page.$('#capture-root');
      if (!captureRoot) {
        throw new Error(`#capture-root not found when rendering frame ${entry.id}`);
      }
      await captureRoot.screenshot({ path: filePath, type: 'png' });

      framePaths.set(entry.id, filePath);
      screenshotIndex++;
      onProgress((i + 1) / uniqueEntries.length);
    }

    return framePaths;
  } finally {
    await browser.close();
  }
}

/**
 * Deduplicates timeline entries to only keep entries with unique visual state IDs.
 * Consecutive entries with the same ID (e.g. hold frames) are collapsed.
 */
function deduplicateVisualStates(timeline: TimelineEntry[]): TimelineEntry[] {
  const seen = new Set<string>();
  const unique: TimelineEntry[] = [];

  for (const entry of timeline) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      unique.push(entry);
    }
  }

  return unique;
}

// ---------------------------------------------------------------------------
// FFmpeg concat file
// ---------------------------------------------------------------------------

/**
 * Generates an FFmpeg concat demuxer file.
 *
 * Each timeline entry maps to its screenshot with a duration based on
 * holdFrames. This avoids duplicate PNGs — a 1-second breathing gap
 * is one PNG held for 1s, not 24 identical PNGs.
 */
async function generateConcatFile(
  timeline: TimelineEntry[],
  framePaths: Map<string, string>,
  workDir: string,
): Promise<string> {
  const lines: string[] = [];

  for (const entry of timeline) {
    const framePath = framePaths.get(entry.id);
    if (!framePath) continue;

    const duration = (entry.holdFrames / TIMELINE.FPS).toFixed(6);
    lines.push(`file '${framePath}'`);
    lines.push(`duration ${duration}`);
  }

  // FFmpeg concat demuxer requires the last file repeated without duration
  const lastEntry = timeline[timeline.length - 1];
  if (lastEntry) {
    const lastPath = framePaths.get(lastEntry.id);
    if (lastPath) {
      lines.push(`file '${lastPath}'`);
    }
  }

  const concatPath = path.join(workDir, 'concat.txt');
  await fs.writeFile(concatPath, lines.join('\n'));
  return concatPath;
}

// ---------------------------------------------------------------------------
// FFmpeg mux
// ---------------------------------------------------------------------------

/**
 * Muxes video frames + audio into final MP4.
 *
 * Uses concat demuxer for variable-duration frames. Pads 414x896
 * capture to 1080x1920 (9:16 vertical video) with black bars.
 */
async function ffmpegMux(
  concatFile: string,
  audioFile: string,
  outputPath: string,
  totalDuration: number,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const args = [
      '-f', 'concat', '-safe', '0', '-i', concatFile,
      '-i', audioFile,
      '-vf', 'pad=1080:1920:(1080-iw)/2:(1920-ih)/2:color=black',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-c:a', 'aac', '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-shortest',
      '-y', outputPath,
    ];

    const proc = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    const MAX_STDERR = 2000;
    let settled = false;

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      if (stderr.length > MAX_STDERR) {
        stderr = stderr.slice(-MAX_STDERR);
      }

      // Parse progress from FFmpeg time= output
      const match = chunk.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        if (totalDuration > 0) {
          onProgress(Math.min(currentTime / totalDuration, 1));
        }
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}:\n${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(new Error(`FFmpeg failed to start: ${err.message}`));
    });

    // Hard timeout to prevent hanging
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGKILL');
      reject(new Error(`FFmpeg timed out after ${FFMPEG_TIMEOUT_MS / 1000}s`));
    }, FFMPEG_TIMEOUT_MS);
  });
}
