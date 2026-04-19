/**
 * Frame-based typing indicator for Puppeteer frame capture.
 *
 * Renders three dots that cycle through a wave animation driven by
 * typingFrame, NOT by CSS animation. This ensures deterministic
 * screenshots — each frame produces identical DOM for the same
 * typingFrame value.
 *
 * The Flutter app uses AnimationController(duration: 900ms)..repeat()
 * which produces a continuously cycling dot animation. During export,
 * the animation runs in real-time while frames are captured, so the
 * captured frames show multiple animation cycles.
 *
 * We replicate this with a 12-frame cycle period (0.5s at 24fps):
 *   Frames  0– 3: dot 0 active (bounce up)
 *   Frames  4– 7: dot 1 active
 *   Frames  8–11: dot 2 active
 *   Frames 12–15: dot 0 active (cycle repeats)
 *   ... and so on for the total FRIEND_TYPING_FRAMES (36 frames = 3 cycles)
 */

import type { StyleTokens } from '@/lib/types';
import { TIMELINE } from '@/lib/timeline-compiler';

interface ExportTypingIndicatorProps {
  /** Animation frame index (0 to FRIEND_TYPING_FRAMES-1). */
  typingFrame: number;
  tokens: StyleTokens;
}

/** Number of dots in the indicator. */
const DOT_COUNT = 3;
/** Frames each dot stays "active" within one cycle. */
const FRAMES_PER_DOT = TIMELINE.TYPING_DOT_CYCLE_FRAMES / DOT_COUNT; // 4

export function ExportTypingIndicator({
  typingFrame,
  tokens,
}: ExportTypingIndicatorProps) {
  // Modular cycling: which position in the cycle are we?
  const cyclePosition = typingFrame % TIMELINE.TYPING_DOT_CYCLE_FRAMES;
  const activeDot = Math.floor(cyclePosition / FRAMES_PER_DOT);
  // How far through the active dot's "beat" (0.0 to 1.0)
  const beatProgress = (cyclePosition % FRAMES_PER_DOT) / FRAMES_PER_DOT;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        paddingLeft: 12,
        paddingRight: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          backgroundColor: tokens.typingIndicatorBg,
          borderRadius: tokens.bubbleRadius,
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        {Array.from({ length: DOT_COUNT }, (_, i) => {
          const isActiveDot = i === activeDot;
          // Active dot bounces up with a sine-like curve, then back down
          const bounce = isActiveDot ? Math.sin(beatProgress * Math.PI) : 0;

          return (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isActiveDot ? '#666' : '#999',
                opacity: isActiveDot ? 1 : 0.4,
                transform: `translateY(${-bounce * 4}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
