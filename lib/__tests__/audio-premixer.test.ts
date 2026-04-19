/**
 * Tests for the audio pre-mixer.
 *
 * Verifies WAV output validity, correct sample placement, and
 * clipping prevention when sounds overlap.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import { loadSoundAssets, mixAudio, type SoundAssets } from '@/lib/audio-premixer';
import { compileTimeline } from '@/lib/timeline-compiler';
import type { Conversation, TimelineEntry } from '@/lib/types';

const SOUND_DIR = path.resolve(__dirname, '../../public/sounds');

/** WAV header size in bytes. */
const WAV_HEADER_SIZE = 44;
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const SAMPLES_PER_FRAME = SAMPLE_RATE / 24; // 2000

let assets: SoundAssets;

beforeAll(async () => {
  assets = await loadSoundAssets(SOUND_DIR);
});

describe('loadSoundAssets', () => {
  it('loads all three sound assets with non-empty samples', () => {
    expect(assets.keystroke.samples.length).toBeGreaterThan(0);
    expect(assets.swoosh.samples.length).toBeGreaterThan(0);
    expect(assets.receive.samples.length).toBeGreaterThan(0);
  });

  it('loads samples as Int16Array', () => {
    expect(assets.keystroke.samples).toBeInstanceOf(Int16Array);
    expect(assets.swoosh.samples).toBeInstanceOf(Int16Array);
    expect(assets.receive.samples).toBeInstanceOf(Int16Array);
  });
});

describe('mixAudio', () => {
  it('produces a valid WAV file header', () => {
    const conversation: Conversation = {
      messages: [{ id: '1', kind: 'text' as const, text: 'Hi', sender: 'friend' }],
      contact: { name: 'Test' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conversation);
    const wav = mixAudio(timeline, assets);

    // RIFF header
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');

    // fmt sub-chunk
    expect(wav.toString('ascii', 12, 16)).toBe('fmt ');
    expect(wav.readUInt16LE(20)).toBe(1); // PCM format
    expect(wav.readUInt16LE(22)).toBe(CHANNELS);
    expect(wav.readUInt32LE(24)).toBe(SAMPLE_RATE);
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample

    // data sub-chunk
    expect(wav.toString('ascii', 36, 40)).toBe('data');
    const dataSize = wav.readUInt32LE(40);
    expect(dataSize).toBe(wav.byteLength - WAV_HEADER_SIZE);
  });

  it('produces correct total duration for a 3-message conversation', () => {
    const conversation: Conversation = {
      messages: [
        { id: '1', kind: 'text' as const, text: 'Hey!', sender: 'you' },
        { id: '2', kind: 'text' as const, text: 'Hi there', sender: 'friend' },
        { id: '3', kind: 'text' as const, text: 'How are you?', sender: 'you' },
      ],
      contact: { name: 'Test' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conversation);
    const wav = mixAudio(timeline, assets);

    const dataSize = wav.readUInt32LE(40);
    const totalSamples = dataSize / (CHANNELS * 2); // 2 bytes per sample
    const durationSec = totalSamples / SAMPLE_RATE;

    // Timeline should produce a reasonable duration (> 3 seconds for 3 messages)
    expect(durationSec).toBeGreaterThan(3);
    // And not excessively long (< 60 seconds for 3 short messages)
    expect(durationSec).toBeLessThan(60);
  });

  it('places keystroke sounds at correct sample offsets', () => {
    const conversation: Conversation = {
      messages: [{ id: '1', kind: 'text' as const, text: 'AB', sender: 'you' }],
      contact: { name: 'Test' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conversation);
    const wav = mixAudio(timeline, assets);

    // Extract PCM data after header
    const pcm = new Int16Array(
      wav.buffer,
      wav.byteOffset + WAV_HEADER_SIZE,
      (wav.byteLength - WAV_HEADER_SIZE) / 2,
    );

    // First entry is 'empty' (1 frame), then 'you-typing' starts
    // The first keystroke should be at frame 1 (after the empty frame)
    const keystrokeOffset = 1 * SAMPLES_PER_FRAME * CHANNELS;

    // At least some samples at the keystroke offset should be non-zero
    let hasNonZero = false;
    for (let i = 0; i < assets.keystroke.samples.length && !hasNonZero; i++) {
      if (pcm[keystrokeOffset + i] !== 0) {
        hasNonZero = true;
      }
    }
    expect(hasNonZero).toBe(true);
  });

  it('clamps overlapping sounds instead of wrapping', () => {
    // Use synthetic assets that would overflow if not clamped:
    // Two sounds with samples at +30000 would sum to +60000,
    // which wraps to a negative in Int16 without clamping.
    const loudSample = new Int16Array([30000, 30000, 30000, 30000]);
    const syntheticAssets: SoundAssets = {
      keystroke: { samples: loudSample },
      swoosh: { samples: loudSample },
      receive: { samples: loudSample },
    };

    // Two events at the same frame to force overlap
    const timeline: TimelineEntry[] = [
      {
        id: 'test-0',
        type: 'you-bubble',
        messageIndex: 0,
        holdFrames: 1,
        audioEvents: [
          { type: 'keystroke', soundIndex: 0 },
          { type: 'swoosh', soundIndex: 0 },
        ],
        visibleMessageCount: 1,
        showTypingIndicator: false,
        composerText: null,
      },
    ];

    const wav = mixAudio(timeline, syntheticAssets);
    const pcm = new Int16Array(
      wav.buffer,
      wav.byteOffset + WAV_HEADER_SIZE,
      (wav.byteLength - WAV_HEADER_SIZE) / 2,
    );

    // 30000 + 30000 = 60000 should be clamped to 32767, not wrapped
    expect(pcm[0]).toBe(32767);
    expect(pcm[1]).toBe(32767);
  });

  it('produces non-silent output for conversations with audio events', () => {
    const conversation: Conversation = {
      messages: [{ id: '1', kind: 'text' as const, text: 'Hello', sender: 'you' }],
      contact: { name: 'Test' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conversation);
    const wav = mixAudio(timeline, assets);

    const pcm = new Int16Array(
      wav.buffer,
      wav.byteOffset + WAV_HEADER_SIZE,
      (wav.byteLength - WAV_HEADER_SIZE) / 2,
    );

    // At least some samples should be non-zero (we have keystrokes + swoosh)
    const hasAudio = pcm.some((s) => s !== 0);
    expect(hasAudio).toBe(true);
  });

  it('produces silence for empty conversation', () => {
    const conversation: Conversation = {
      messages: [],
      contact: { name: 'Test' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conversation);
    const wav = mixAudio(timeline, assets);

    const pcm = new Int16Array(
      wav.buffer,
      wav.byteOffset + WAV_HEADER_SIZE,
      (wav.byteLength - WAV_HEADER_SIZE) / 2,
    );

    // Empty conversation has no audio events — all samples should be zero
    const allSilent = pcm.every((s) => s === 0);
    expect(allSilent).toBe(true);
  });

  it('includes receive sound for friend messages', () => {
    const conversation: Conversation = {
      messages: [{ id: '1', kind: 'text' as const, text: 'Hey!', sender: 'friend' }],
      contact: { name: 'Test' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conversation);
    const wav = mixAudio(timeline, assets);

    const pcm = new Int16Array(
      wav.buffer,
      wav.byteOffset + WAV_HEADER_SIZE,
      (wav.byteLength - WAV_HEADER_SIZE) / 2,
    );

    // Should have non-zero samples from the receive sound
    const hasAudio = pcm.some((s) => s !== 0);
    expect(hasAudio).toBe(true);
  });
});
