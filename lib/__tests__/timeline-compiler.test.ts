/**
 * Unit tests for the TimelineCompiler.
 *
 * Tests the pure function: conversation → timeline entries.
 * No browser dependencies, no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import {
  compileTimeline,
  totalFrames,
  videoDuration,
  splitGraphemes,
  TIMELINE,
} from '@/lib/timeline-compiler';
import type { Conversation, ChatMessage } from '@/lib/types';

/** Helper to build a test conversation. */
function makeConversation(
  messages: Array<{ text: string; sender: 'you' | 'friend' }>,
): Conversation {
  return {
    messages: messages.map((m, i) => ({
      id: `msg-${i}`,
      kind: 'text' as const,
      text: m.text,
      sender: m.sender,
    })),
    contact: { name: 'Jane' },
    style: 'imessage',
  };
}

describe('compileTimeline', () => {
  it('returns a single empty entry for 0 messages', () => {
    const timeline = compileTimeline(makeConversation([]));
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('empty');
    expect(timeline[0].holdFrames).toBe(1);
  });

  it('compiles a single friend message correctly', () => {
    const timeline = compileTimeline(
      makeConversation([{ text: 'Hi!', sender: 'friend' }]),
    );

    // First entry is empty
    expect(timeline[0].type).toBe('empty');

    // Count friend-typing entries (proportional to message length)
    const typingEntries = timeline.filter((e) => e.type === 'friend-typing');
    expect(typingEntries.length).toBeGreaterThanOrEqual(TIMELINE.FRIEND_TYPING_MIN_FRAMES);

    // Typing frames should have sequential typingFrame values 0..N-1
    typingEntries.forEach((entry, idx) => {
      expect(entry.typingFrame).toBe(idx);
      expect(entry.showTypingIndicator).toBe(true);
      expect(entry.visibleMessageCount).toBe(0);
    });

    // Last entry is friend-bubble
    const bubble = timeline[timeline.length - 1];
    expect(bubble.type).toBe('friend-bubble');
    expect(bubble.visibleMessageCount).toBe(1);
    expect(bubble.audioEvents).toEqual([{ type: 'receive', soundIndex: 0 }]);
  });

  it('compiles a single you message with keystrokes', () => {
    const timeline = compileTimeline(
      makeConversation([{ text: 'Hey', sender: 'you' }]),
    );

    // empty + 3 chars + send pause + bubble = 6
    expect(timeline).toHaveLength(6);

    // 3 you-typing entries with keystrokes
    for (let i = 1; i <= 3; i++) {
      const entry = timeline[i];
      expect(entry.type).toBe('you-typing');
      expect(entry.charsVisible).toBe(i);
      // composerText is null — renderer derives it from charsVisible
      expect(entry.composerText).toBeNull();
      expect(entry.audioEvents).toHaveLength(1);
      expect(entry.audioEvents[0].type).toBe('keystroke');
    }

    // Send pause (no audio)
    expect(timeline[4].type).toBe('you-typing');
    expect(timeline[4].holdFrames).toBe(TIMELINE.YOU_SEND_PAUSE_FRAMES);
    expect(timeline[4].audioEvents).toHaveLength(0);

    // Bubble with swoosh
    expect(timeline[5].type).toBe('you-bubble');
    expect(timeline[5].audioEvents).toEqual([{ type: 'swoosh', soundIndex: 0 }]);
    expect(timeline[5].visibleMessageCount).toBe(1);
  });

  it('adds breathing gaps between messages', () => {
    const timeline = compileTimeline(
      makeConversation([
        { text: 'Hi', sender: 'friend' },
        { text: 'Hey', sender: 'you' },
      ]),
    );

    // Find breathing entry
    const breathingEntries = timeline.filter((e) => e.type === 'breathing');
    expect(breathingEntries).toHaveLength(1);
    expect(breathingEntries[0].holdFrames).toBe(TIMELINE.BREATHING_GAP_FRAMES);
  });

  it('handles emoji as single graphemes (not split into code units)', () => {
    const timeline = compileTimeline(
      makeConversation([{ text: '😂', sender: 'you' }]),
    );

    // A single emoji should produce exactly 1 typing frame + send pause + bubble
    // empty(1) + typing(1) + sendPause(1) + bubble(1) = 4 entries
    const typingEntries = timeline.filter(
      (e) => e.type === 'you-typing' && e.audioEvents.length > 0,
    );
    expect(typingEntries).toHaveLength(1); // One grapheme = one keystroke
    expect(typingEntries[0].charsVisible).toBe(1);
  });

  it('handles skin-tone emoji as single graphemes', () => {
    const timeline = compileTimeline(
      makeConversation([{ text: '👍🏽', sender: 'you' }]),
    );

    const typingEntries = timeline.filter(
      (e) => e.type === 'you-typing' && e.audioEvents.length > 0,
    );
    expect(typingEntries).toHaveLength(1); // 👍🏽 is one grapheme
  });

  it('splitGraphemes correctly segments mixed text', () => {
    expect(splitGraphemes('Hi😂!')).toEqual(['H', 'i', '😂', '!']);
    expect(splitGraphemes('👨‍👩‍👧')).toHaveLength(1); // ZWJ family
    expect(splitGraphemes('')).toEqual([]);
  });

  it('handles punctuation pauses in you-typing', () => {
    const timeline = compileTimeline(
      makeConversation([{ text: 'Hi!', sender: 'you' }]),
    );

    // The '!' character (3rd grapheme, charsVisible=3) should have extra hold frames
    const exclamation = timeline.find(
      (e) => e.type === 'you-typing' && e.charsVisible === 3 && e.audioEvents.length > 0,
    );
    expect(exclamation).toBeDefined();
    expect(exclamation!.holdFrames).toBe(
      TIMELINE.YOU_CHAR_HOLD_FRAMES + TIMELINE.PUNCTUATION_EXTRA_FRAMES,
    );
  });

  it('scales friend typing duration with message length', () => {
    const short = compileTimeline(
      makeConversation([{ text: 'Hi', sender: 'friend' }]),
    );
    const long = compileTimeline(
      makeConversation([{ text: 'A'.repeat(100), sender: 'friend' }]),
    );

    const shortTyping = short.filter((e) => e.type === 'friend-typing').length;
    const longTyping = long.filter((e) => e.type === 'friend-typing').length;

    // Longer messages should have more typing indicator frames
    expect(longTyping).toBeGreaterThan(shortTyping);
    // But both should meet the minimum
    expect(shortTyping).toBeGreaterThanOrEqual(TIMELINE.FRIEND_TYPING_MIN_FRAMES);
  });

  it('scales read pause with message length', () => {
    const short = compileTimeline(
      makeConversation([{ text: 'Hi', sender: 'friend' }]),
    );
    const long = compileTimeline(
      makeConversation([{ text: 'A'.repeat(200), sender: 'friend' }]),
    );

    const shortBubble = short.find((e) => e.type === 'friend-bubble')!;
    const longBubble = long.find((e) => e.type === 'friend-bubble')!;

    expect(longBubble.holdFrames).toBeGreaterThan(shortBubble.holdFrames);
  });

  it('caps read pause at the maximum', () => {
    const timeline = compileTimeline(
      makeConversation([{ text: 'A'.repeat(500), sender: 'friend' }]),
    );

    const bubble = timeline.find((e) => e.type === 'friend-bubble')!;
    // Max pause = (500 + min(500*30, 3000)) / 1000 * 24 = (500+3000)/1000*24 = 84
    const maxFrames = Math.round(
      ((TIMELINE.READ_PAUSE_BASE_MS + TIMELINE.READ_PAUSE_MAX_ADDITIONAL_MS) *
        TIMELINE.FPS) /
        1000,
    );
    expect(bubble.holdFrames).toBe(maxFrames);
  });

  it('handles empty message text gracefully', () => {
    const conv = makeConversation([{ text: '', sender: 'you' }]);
    // Empty string has 0 graphemes — should produce send pause + bubble only
    const timeline = compileTimeline(conv);
    const typingWithKeystroke = timeline.filter(
      (e) => e.type === 'you-typing' && e.audioEvents.length > 0,
    );
    expect(typingWithKeystroke).toHaveLength(0); // no chars = no keystrokes
  });

  it('is deterministic — same input produces same output', () => {
    const conv = makeConversation([
      { text: 'Hello', sender: 'you' },
      { text: 'Hi there!', sender: 'friend' },
      { text: 'How are you?', sender: 'you' },
    ]);

    const run1 = compileTimeline(conv);
    const run2 = compileTimeline(conv);

    expect(run1).toEqual(run2);
  });

  it('handles a long conversation (50 messages) without excessive frames', () => {
    const msgs: Array<{ text: string; sender: 'you' | 'friend' }> = [];
    for (let i = 0; i < 50; i++) {
      msgs.push({
        text: `Message ${i}`,
        sender: i % 2 === 0 ? 'you' : 'friend',
      });
    }

    const timeline = compileTimeline(makeConversation(msgs));
    const frames = totalFrames(timeline);
    const duration = videoDuration(timeline);

    // 50 messages with ~4 frames/char should produce a reasonable video
    expect(duration).toBeGreaterThan(60);
    expect(duration).toBeLessThan(600);
    expect(frames).toBeGreaterThan(1500);
  });

  it('totalFrames and videoDuration helpers work correctly', () => {
    const timeline = compileTimeline(
      makeConversation([{ text: 'Hi', sender: 'friend' }]),
    );

    const frames = totalFrames(timeline);
    const duration = videoDuration(timeline);

    expect(frames).toBeGreaterThan(0);
    expect(duration).toBeCloseTo(frames / TIMELINE.FPS, 5);
  });

  it('visibleMessageCount increments correctly through the timeline', () => {
    const timeline = compileTimeline(
      makeConversation([
        { text: 'A', sender: 'you' },
        { text: 'B', sender: 'friend' },
      ]),
    );

    // Find the bubble entries
    const youBubble = timeline.find((e) => e.type === 'you-bubble')!;
    const friendBubble = timeline.find((e) => e.type === 'friend-bubble')!;

    expect(youBubble.visibleMessageCount).toBe(1);
    expect(friendBubble.visibleMessageCount).toBe(2);
  });

  it('compiles a friend image message with no typing indicator', () => {
    const conv: Conversation = {
      messages: [
        { id: 'img-1', sender: 'friend', kind: 'image', imageUrl: '/test.jpg' },
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    const typingEntries = timeline.filter((e) => e.type === 'friend-typing');
    expect(typingEntries).toHaveLength(0);

    const bubble = timeline.find((e) => e.type === 'friend-bubble');
    expect(bubble).toBeDefined();
    expect(bubble!.visibleMessageCount).toBe(1);
    expect(bubble!.audioEvents).toEqual([{ type: 'receive', soundIndex: 0 }]);
  });

  it('compiles a you image message with no typing animation', () => {
    const conv: Conversation = {
      messages: [
        { id: 'img-2', sender: 'you', kind: 'image', imageUrl: '/test.jpg' },
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    const typingEntries = timeline.filter((e) => e.type === 'you-typing');
    expect(typingEntries).toHaveLength(0);

    const bubble = timeline.find((e) => e.type === 'you-bubble');
    expect(bubble).toBeDefined();
    expect(bubble!.audioEvents).toEqual([{ type: 'swoosh', soundIndex: 0 }]);
  });

  it('image message uses fixed IMAGE_READ_PAUSE_FRAMES hold duration', () => {
    const conv: Conversation = {
      messages: [
        { id: 'img-3', sender: 'friend', kind: 'image', imageUrl: '/test.jpg' },
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    const bubble = timeline.find((e) => e.type === 'friend-bubble')!;
    expect(bubble.holdFrames).toBe(TIMELINE.IMAGE_READ_PAUSE_FRAMES);
  });

  it('compiles mixed text and image messages correctly', () => {
    const conv: Conversation = {
      messages: [
        { id: 'msg-0', sender: 'you', kind: 'text', text: 'Hey' },
        { id: 'img-1', sender: 'friend', kind: 'image', imageUrl: '/photo.jpg' },
        { id: 'msg-2', sender: 'friend', kind: 'text', text: 'Check this out' },
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    const youTyping = timeline.filter((e) => e.type === 'you-typing');
    expect(youTyping.length).toBeGreaterThan(0);

    const friendTyping = timeline.filter((e) => e.type === 'friend-typing');
    expect(friendTyping.length).toBeGreaterThan(0);

    // 2 inter-message breathing gaps + 1 image pre-appear delay = 3 breathing entries
    const breathing = timeline.filter((e) => e.type === 'breathing');
    expect(breathing).toHaveLength(3);

    const bubbles = timeline.filter(
      (e) => e.type === 'you-bubble' || e.type === 'friend-bubble',
    );
    expect(bubbles).toHaveLength(3);
  });

  it('treats messages without kind field as text (backwards compat)', () => {
    const conv: Conversation = {
      messages: [
        { id: 'legacy-0', sender: 'you', text: 'Old message' } as ChatMessage,
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    const typingEntries = timeline.filter((e) => e.type === 'you-typing');
    expect(typingEntries.length).toBeGreaterThan(0);
  });
});
