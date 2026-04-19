/**
 * Full chat layout for Puppeteer frame capture.
 *
 * Composes ExportHeader + ExportMessageList + ExportComposer into a
 * single 414x896 view. Reads from a TimelineEntry to determine what
 * to display: which messages are visible, whether typing indicator
 * is shown, and what text appears in the composer.
 *
 * Key differences from editor components:
 * - No interactivity — no click handlers, no state, no effects
 * - No CSS animations — typing dots driven by typingFrame
 * - Uses inline styles (not Tailwind) for Puppeteer determinism
 * - Uses plain <img> tags (NOT next/image)
 * - composerText derived from charsVisible, not stored in TimelineEntry
 */

import type { Conversation, TimelineEntry } from '@/lib/types';
import { STYLE_TOKENS } from '@/lib/style-tokens';
import { splitGraphemes } from '@/lib/timeline-compiler';
import { ExportHeader } from '@/components/export/ExportHeader';
import { ExportMessageList } from '@/components/export/ExportMessageList';
import { ExportComposer } from '@/components/export/ExportComposer';

interface ExportChatViewProps {
  conversation: Conversation;
  frame: TimelineEntry;
}

export function ExportChatView({ conversation, frame }: ExportChatViewProps) {
  const tokens = STYLE_TOKENS[conversation.style];
  const { messages, contact } = conversation;

  // Slice messages to visibleMessageCount
  const visibleMessages = messages.slice(0, frame.visibleMessageCount);

  // Derive composer text from charsVisible (avoids O(n^2) in timeline compiler)
  let composerText: string | null = null;
  if (
    frame.type === 'you-typing' &&
    frame.messageIndex !== null &&
    frame.charsVisible !== undefined
  ) {
    const msg = messages[frame.messageIndex];
    if (msg) {
      composerText = msg.kind === 'text'
        ? splitGraphemes(msg.text).slice(0, frame.charsVisible).join('')
        : '';
    }
  }

  return (
    <div
      style={{
        width: 414,
        height: 896,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: tokens.fontFamily,
        position: 'relative',
      }}
    >
      {/* Status bar + header — single background to avoid seam */}
      <div style={{ backgroundColor: tokens.headerBg, flexShrink: 0 }}>
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              width: 126,
              height: 34,
              borderRadius: 17,
              backgroundColor: '#000000',
            }}
          />
        </div>
        <ExportHeader contact={contact} tokens={tokens} style={conversation.style} />
      </div>

      {/* Message list + typing indicator */}
      <ExportMessageList
        messages={visibleMessages}
        tokens={tokens}
        style={conversation.style}
        contactName={contact.name}
        contactImage={contact.profileImageUrl}
        showTypingIndicator={frame.showTypingIndicator}
        typingFrame={frame.typingFrame}
      />

      {/* Composer bar */}
      <ExportComposer composerText={composerText} tokens={tokens} />
    </div>
  );
}
