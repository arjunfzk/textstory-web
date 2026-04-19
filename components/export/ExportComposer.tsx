/**
 * Static composer bar for Puppeteer frame capture.
 *
 * During "you-typing" frames, shows the partially typed text derived from
 * the current TimelineEntry's charsVisible + the message's full text.
 * When no typing is active, shows an empty text field placeholder.
 *
 * composerText in TimelineEntry is null to avoid O(n^2) string allocation.
 * The renderer derives it: splitGraphemes(msg.text).slice(0, charsVisible).join('')
 */

import type { StyleTokens } from '@/lib/types';

interface ExportComposerProps {
  /** Text currently being typed, or null if no active typing. */
  composerText: string | null;
  tokens: StyleTokens;
}

export function ExportComposer({ composerText, tokens }: ExportComposerProps) {
  return (
    <div
      style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 16,
        gap: 8,
        backgroundColor: tokens.headerBg,
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Text field */}
      <div
        style={{
          flex: 1,
          height: 36,
          borderRadius: 18,
          border: '1px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: 'rgba(229, 231, 235, 0.2)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
          paddingRight: 14,
          fontFamily: tokens.fontFamily,
          fontSize: 15,
          color: composerText ? tokens.headerText : 'rgba(156, 163, 175, 0.6)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {composerText ?? ''}
      </div>

      {/* Send button — arrow icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: composerText
            ? '#007AFF'
            : 'rgba(59, 130, 246, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 2 }}>
          <path d="M3.67 20.4l17.2-8.1c.46-.22.46-.86 0-1.08L3.67 3.12c-.52-.24-1.1.1-1.1.67v5.45c0 .4.28.74.68.8L14 12l-10.75 1.97c-.4.05-.68.4-.68.8v5.45c0 .57.58.91 1.1.67z" />
        </svg>
      </div>
    </div>
  );
}
