/**
 * TimelineCompiler — the intellectual core of the video export pipeline.
 *
 * Pure function: converts a Conversation into a deterministic sequence of
 * TimelineEntry objects. Each entry represents one visual state in the video.
 * Same input always produces the same output — no randomness, no side effects,
 * no browser dependencies. Fully unit-testable.
 *
 * The renderer (Puppeteer) iterates through these entries, screenshots each
 * unique visual state, and holds frames for the specified duration. The audio
 * pre-mixer reads the audioEvents from each entry to place sounds.
 */

import type { AudioEvent, Conversation, TimelineEntry } from '@/lib/types';

// ---------------------------------------------------------------------------
// Timing constants — ported from Flutter chat_screen.dart
// ---------------------------------------------------------------------------

/** Frozen to prevent accidental mutation — determinism guarantee. */
export const TIMELINE = Object.freeze({
  /** Video frame rate. */
  FPS: 24,

  /** Duration of one frame in milliseconds. */
  FRAME_DURATION_MS: 1000 / 24,

  /** Pause between messages (all senders). Snappy for TikTok/Reels pacing. */
  BREATHING_GAP_FRAMES: 12, // 0.5 seconds

  /**
   * Friend typing indicator — sublinear sqrt curve for natural pacing.
   * Formula: clamp(650 + 140*sqrt(chars) + 8*chars, 700, 2600) ms
   * Computed in calculateFriendTypingFrames(), these constants feed it.
   * Examples: 10 chars → 1173ms (28f), 60 chars → 2214ms (53f), 100+ → 2600ms cap (62f)
   */
  FRIEND_TYPING_SQRT_COEFF: 140,
  FRIEND_TYPING_LINEAR_COEFF: 8,
  FRIEND_TYPING_BASE_MS: 650,
  FRIEND_TYPING_MIN_MS: 700,
  FRIEND_TYPING_MAX_MS: 2600,
  /** Minimum frames for friend typing (must complete at least 1 dot cycle). */
  FRIEND_TYPING_MIN_FRAMES: 18,

  /**
   * Frames per character in "you" typing animation.
   * 3 frames/char = 125ms/char = ~8 chars/sec — snappy for short-form video.
   */
  YOU_CHAR_HOLD_FRAMES: 3,

  /**
   * Extra hold frames at punctuation (. ! ? , space) during "you" typing.
   * 2 extra frames on top of base 3 = 5 total = 208ms at punctuation.
   */
  PUNCTUATION_EXTRA_FRAMES: 2,

  /** Pause after final character before send. */
  YOU_SEND_PAUSE_FRAMES: 11, // ~0.46 seconds

  /** Read pause: minimum milliseconds. */
  READ_PAUSE_BASE_MS: 350,
  /** Read pause: additional ms per character. */
  READ_PAUSE_PER_CHAR_MS: 18,
  /** Read pause: max additional ms (caps at ~1.95s total). */
  READ_PAUSE_MAX_ADDITIONAL_MS: 1600,

  /** Minimum gap between keystroke sounds (prevents overlap). */
  MIN_KEYSTROKE_SPACING_FRAMES: 1,
  /** Don't play keystrokes within this many frames of swoosh/receive. */
  KEYSTROKE_EVENT_BUFFER_FRAMES: 3,

  /**
   * Typing indicator dot cycle period in frames.
   * 3 dots cycling through in 18 frames = 0.75s per cycle.
   * Each dot is "active" (bouncing) for 6 frames — less twitchy than 12f cycle.
   */
  TYPING_DOT_CYCLE_FRAMES: 18,

  /**
   * Read pause for image messages — fixed duration since images have no text.
   * 30 frames = 1.25 seconds at 24fps.
   */
  IMAGE_READ_PAUSE_FRAMES: 30,

  /** Pre-appear delay for friend image messages — simulates "sending" feel. */
  FRIEND_IMAGE_DELAY_FRAMES: 8, // 333ms
  /** Pre-send delay for you image messages. */
  YOU_IMAGE_DELAY_FRAMES: 6, // 250ms
});

/** Frozen punctuation set — extracted from TIMELINE for Object.freeze compat. */
const PUNCTUATION_SET = new Set(['.', '!', '?', ',', ' ']);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compiles a conversation into a deterministic frame-by-frame timeline.
 *
 * @param conversation - The conversation to compile
 * @returns Ordered array of timeline entries
 */
export function compileTimeline(conversation: Conversation): TimelineEntry[] {
  const { messages } = conversation;
  const entries: TimelineEntry[] = [];

  // Frame 0: empty screen
  entries.push(makeEntry({
    id: 'empty-0',
    type: 'empty',
    holdFrames: 1,
    visibleMessageCount: 0,
  }));

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const visibleBefore = i;
    const visibleAfter = i + 1;

    // Breathing gap between messages (skip for first)
    if (i > 0) {
      entries.push(makeEntry({
        id: `breathing-${i}`,
        type: 'breathing',
        holdFrames: TIMELINE.BREATHING_GAP_FRAMES,
        visibleMessageCount: visibleBefore,
      }));
    }

    // Image messages: brief pre-appear delay then bubble (no typing animation)
    const msgKind = 'kind' in msg ? msg.kind : 'text';
    if (msgKind === 'image') {
      const isFriend = msg.sender === 'friend';
      const bubbleType = isFriend ? 'friend-bubble' : 'you-bubble';
      const soundType = isFriend ? 'receive' : 'swoosh';
      const delayFrames = isFriend
        ? TIMELINE.FRIEND_IMAGE_DELAY_FRAMES
        : TIMELINE.YOU_IMAGE_DELAY_FRAMES;

      // Pre-appear delay — simulates sending/receiving feel
      entries.push(makeEntry({
        id: `image-delay-${i}`,
        type: 'breathing',
        holdFrames: delayFrames,
        visibleMessageCount: visibleBefore,
      }));

      // Image bubble appears
      entries.push(makeEntry({
        id: `${bubbleType}-${i}`,
        type: bubbleType,
        messageIndex: i,
        holdFrames: TIMELINE.IMAGE_READ_PAUSE_FRAMES,
        visibleMessageCount: visibleAfter,
        audioEvents: [{ type: soundType, soundIndex: 0 }],
      }));
      // No typing animation or send-pause — image appears instantly
      continue;
    }

    if (msg.sender === 'friend') {
      // Friend typing indicator — duration proportional to message length
      const text = 'text' in msg ? msg.text : '';
      const friendTypingFrames = calculateFriendTypingFrames(text);
      for (let f = 0; f < friendTypingFrames; f++) {
        entries.push(makeEntry({
          id: `friend-typing-${i}-${f}`,
          type: 'friend-typing',
          messageIndex: i,
          typingFrame: f,
          holdFrames: 1,
          visibleMessageCount: visibleBefore,
          showTypingIndicator: true,
        }));
      }

      // Friend bubble appears
      entries.push(makeEntry({
        id: `friend-bubble-${i}`,
        type: 'friend-bubble',
        messageIndex: i,
        holdFrames: calculateReadPauseFrames(text),
        visibleMessageCount: visibleAfter,
        audioEvents: [{ type: 'receive', soundIndex: 0 }],
      }));
    } else {
      // You typing — character by character using grapheme segmentation
      const text = 'text' in msg ? msg.text : '';
      const graphemes = splitGraphemes(text);
      for (let c = 0; c < graphemes.length; c++) {
        const isPunctuation = PUNCTUATION_SET.has(graphemes[c]);
        const hold = isPunctuation
          ? TIMELINE.YOU_CHAR_HOLD_FRAMES + TIMELINE.PUNCTUATION_EXTRA_FRAMES
          : TIMELINE.YOU_CHAR_HOLD_FRAMES;

        entries.push(makeEntry({
          id: `you-typing-${i}-${c}`,
          type: 'you-typing',
          messageIndex: i,
          charsVisible: c + 1,
          holdFrames: hold,
          visibleMessageCount: visibleBefore,
          // composerText derived from charsVisible at render time — not stored
          // to avoid O(n^2) string allocation. Renderer uses:
          //   splitGraphemes(message.text).slice(0, charsVisible).join('')
          composerText: null,
          audioEvents: [{ type: 'keystroke', soundIndex: c % 4 }],
        }));
      }

      // Pause before send
      entries.push(makeEntry({
        id: `you-send-pause-${i}`,
        type: 'you-typing',
        messageIndex: i,
        charsVisible: graphemes.length,
        holdFrames: TIMELINE.YOU_SEND_PAUSE_FRAMES,
        visibleMessageCount: visibleBefore,
        composerText: null,
      }));

      // You bubble appears
      entries.push(makeEntry({
        id: `you-bubble-${i}`,
        type: 'you-bubble',
        messageIndex: i,
        holdFrames: calculateReadPauseFrames(text),
        visibleMessageCount: visibleAfter,
        audioEvents: [{ type: 'swoosh', soundIndex: 0 }],
      }));
    }
  }

  return entries;
}

/**
 * Calculate total frame count from a compiled timeline.
 */
export function totalFrames(timeline: TimelineEntry[]): number {
  return timeline.reduce((sum, entry) => sum + entry.holdFrames, 0);
}

/**
 * Calculate video duration in seconds from a compiled timeline.
 */
export function videoDuration(timeline: TimelineEntry[]): number {
  return totalFrames(timeline) / TIMELINE.FPS;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate friend typing indicator frames using sublinear sqrt curve.
 * clamp(650 + 140*sqrt(chars) + 8*chars, 700, 2600) ms → frames at 24fps.
 * Sqrt curve prevents long messages from dragging while still scaling naturally.
 */
function calculateFriendTypingFrames(text: string): number {
  const charCount = splitGraphemes(text).length;
  const raw =
    TIMELINE.FRIEND_TYPING_BASE_MS +
    TIMELINE.FRIEND_TYPING_SQRT_COEFF * Math.sqrt(charCount) +
    TIMELINE.FRIEND_TYPING_LINEAR_COEFF * charCount;
  const ms = Math.max(TIMELINE.FRIEND_TYPING_MIN_MS, Math.min(raw, TIMELINE.FRIEND_TYPING_MAX_MS));
  return Math.max(
    TIMELINE.FRIEND_TYPING_MIN_FRAMES,
    Math.round((ms * TIMELINE.FPS) / 1000),
  );
}

/** Calculate read pause frames based on grapheme count (not code units). */
function calculateReadPauseFrames(text: string): number {
  const charCount = splitGraphemes(text).length;
  const ms =
    TIMELINE.READ_PAUSE_BASE_MS +
    Math.min(
      charCount * TIMELINE.READ_PAUSE_PER_CHAR_MS,
      TIMELINE.READ_PAUSE_MAX_ADDITIONAL_MS,
    );
  return Math.round((ms * TIMELINE.FPS) / 1000);
}

/**
 * Splits text into user-perceived characters (grapheme clusters).
 * Handles emoji (😂), skin-tone modifiers (👍🏽), and ZWJ sequences (👨‍👩‍👧).
 * Uses Intl.Segmenter which is available in Node 16+ and all modern browsers.
 */
/** Module-scoped segmenter — avoids re-creation on every call. */
const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function splitGraphemes(text: string): string[] {
  return [...graphemeSegmenter.segment(text)].map((s) => s.segment);
}

/** Create a TimelineEntry with sensible defaults. */
function makeEntry(partial: {
  id: string;
  type: TimelineEntry['type'];
  holdFrames: number;
  visibleMessageCount: number;
  messageIndex?: number;
  charsVisible?: number;
  typingFrame?: number;
  audioEvents?: AudioEvent[];
  showTypingIndicator?: boolean;
  composerText?: string | null;
}): TimelineEntry {
  return {
    id: partial.id,
    type: partial.type,
    messageIndex: partial.messageIndex ?? null,
    charsVisible: partial.charsVisible,
    typingFrame: partial.typingFrame,
    holdFrames: partial.holdFrames,
    audioEvents: partial.audioEvents ?? [],
    visibleMessageCount: partial.visibleMessageCount,
    showTypingIndicator: partial.showTypingIndicator ?? false,
    composerText: partial.composerText ?? null,
  };
}
