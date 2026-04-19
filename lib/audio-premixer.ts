/**
 * Audio Pre-Mixer — builds a single WAV file from timeline audio events.
 *
 * Strategy: Create a raw PCM buffer (48kHz, 16-bit, stereo) sized to the
 * total video duration. For each audio event in the timeline, read the
 * source WAV asset, calculate the byte offset from the event's frame
 * position, and mix (additive with clamping) into the buffer.
 *
 * This replaces the Flutter app's AVMutableComposition multi-track approach
 * and avoids FFmpeg's adelay filter explosion (500+ keystroke sounds would
 * hit ARG_MAX limits).
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TimelineEntry } from '@/lib/types';
import { TIMELINE, totalFrames } from '@/lib/timeline-compiler';

// ---------------------------------------------------------------------------
// Audio constants
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
/** Samples per video frame at 48kHz / 24fps = 2000. */
const SAMPLES_PER_FRAME = SAMPLE_RATE / TIMELINE.FPS;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw PCM samples for a single sound effect. */
interface SoundAsset {
  /** Interleaved stereo Int16 samples. */
  samples: Int16Array;
}

/** Pre-loaded sound asset collection. */
export interface SoundAssets {
  keystroke: SoundAsset;
  swoosh: SoundAsset;
  receive: SoundAsset;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads sound assets from disk (48kHz stereo WAV files).
 * Call once at pipeline startup, then reuse across exports.
 *
 * @param soundDir - Directory containing keystroke.wav, swoosh.wav, receive.wav
 */
export async function loadSoundAssets(soundDir: string): Promise<SoundAssets> {
  const [keystroke, swoosh, receive] = await Promise.all([
    loadWavPcm(path.join(soundDir, 'keystroke.wav')),
    loadWavPcm(path.join(soundDir, 'swoosh.wav')),
    loadWavPcm(path.join(soundDir, 'receive.wav')),
  ]);

  return { keystroke, swoosh, receive };
}

/**
 * Mixes all audio events from a compiled timeline into a single WAV buffer.
 *
 * Iterates through timeline entries, placing each audio event's sound at
 * the correct sample offset. Uses additive mixing with clamping to prevent
 * clipping when sounds overlap.
 *
 * @param timeline - Compiled timeline entries with audioEvents
 * @param assets - Pre-loaded sound assets
 * @returns Buffer containing a complete WAV file ready for FFmpeg input
 */
export function mixAudio(timeline: TimelineEntry[], assets: SoundAssets): Buffer {
  const frameCount = totalFrames(timeline);
  const totalSampleCount = frameCount * SAMPLES_PER_FRAME * CHANNELS;
  const pcmBuffer = new Int16Array(totalSampleCount);

  let currentFrame = 0;
  for (const entry of timeline) {
    for (const event of entry.audioEvents) {
      const asset = assets[event.type];
      const sampleOffset = currentFrame * SAMPLES_PER_FRAME * CHANNELS;

      // Additive mix with clamping to [-32768, 32767]
      for (
        let i = 0;
        i < asset.samples.length && sampleOffset + i < totalSampleCount;
        i++
      ) {
        const mixed = pcmBuffer[sampleOffset + i] + asset.samples[i];
        pcmBuffer[sampleOffset + i] = Math.max(-32768, Math.min(32767, mixed));
      }
    }
    currentFrame += entry.holdFrames;
  }

  return writeWavFile(pcmBuffer);
}

// ---------------------------------------------------------------------------
// WAV file I/O
// ---------------------------------------------------------------------------

/**
 * Reads a WAV file and returns raw PCM Int16 samples.
 * Validates the RIFF/WAVE header and locates the 'data' chunk.
 */
async function loadWavPcm(filePath: string): Promise<SoundAsset> {
  const fileBuffer = await fs.readFile(filePath);
  const view = new DataView(
    fileBuffer.buffer,
    fileBuffer.byteOffset,
    fileBuffer.byteLength,
  );

  // Validate RIFF header
  const riff = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3),
  );
  if (riff !== 'RIFF') {
    throw new Error(`Not a WAV file: ${filePath} (missing RIFF header)`);
  }

  const wave = String.fromCharCode(
    view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11),
  );
  if (wave !== 'WAVE') {
    throw new Error(`Not a WAV file: ${filePath} (missing WAVE format)`);
  }

  // Scan sub-chunks: validate fmt, then find data
  let offset = 12;
  let fmtValidated = false;

  while (offset < view.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      // Validate expected format: PCM, stereo, 48kHz, 16-bit
      const audioFormat = view.getUint16(offset + 8, true);
      const channels = view.getUint16(offset + 10, true);
      const sampleRate = view.getUint32(offset + 12, true);
      const bitsPerSample = view.getUint16(offset + 22, true);

      if (audioFormat !== 1) {
        throw new Error(`Unsupported audio format ${audioFormat} in ${filePath} (expected PCM=1)`);
      }
      if (channels !== CHANNELS) {
        throw new Error(`Expected ${CHANNELS} channels, got ${channels} in ${filePath}`);
      }
      if (sampleRate !== SAMPLE_RATE) {
        throw new Error(`Expected ${SAMPLE_RATE}Hz, got ${sampleRate}Hz in ${filePath}`);
      }
      if (bitsPerSample !== BITS_PER_SAMPLE) {
        throw new Error(`Expected ${BITS_PER_SAMPLE}-bit, got ${bitsPerSample}-bit in ${filePath}`);
      }
      fmtValidated = true;
    }

    if (chunkId === 'data') {
      if (!fmtValidated) {
        throw new Error(`'data' chunk found before 'fmt ' in ${filePath}`);
      }
      const pcmBytes = fileBuffer.subarray(offset + 8, offset + 8 + chunkSize);
      const samples = new Int16Array(
        pcmBytes.buffer,
        pcmBytes.byteOffset,
        pcmBytes.byteLength / BYTES_PER_SAMPLE,
      );
      return { samples };
    }

    // Move to next chunk (size + 8 bytes for id + size fields, pad to even)
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  throw new Error(`No data chunk found in WAV file: ${filePath}`);
}

/**
 * Prepends a valid WAV file header to raw PCM data.
 *
 * Header is 44 bytes: RIFF(4) + size(4) + WAVE(4) + fmt(24) + data(8).
 * All values are little-endian per WAV spec.
 */
function writeWavFile(pcm: Int16Array): Buffer {
  const pcmBytes = pcm.byteLength;
  const header = Buffer.alloc(44);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBytes, 4); // file size - 8
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28); // byte rate
  header.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32); // block align
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(pcmBytes, 40);

  // Combine header + PCM data
  const pcmBuffer = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  return Buffer.concat([header, pcmBuffer]);
}
