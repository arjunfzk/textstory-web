/**
 * Static message list for Puppeteer frame capture.
 *
 * Renders the visible messages from the conversation based on the
 * TimelineEntry's visibleMessageCount. Messages are always scrolled
 * to the bottom using flexbox column-reverse so newest messages appear
 * at the bottom of the chat area.
 *
 * Also renders the typing indicator when showTypingIndicator is true.
 */

import type { ChatMessage, ChatStyle, StyleTokens } from '@/lib/types';
import { ExportBubble } from '@/components/export/ExportBubble';
import { ExportTypingIndicator } from '@/components/export/ExportTypingIndicator';

interface ExportMessageListProps {
  /** Messages to display (already sliced to visibleMessageCount). */
  messages: ChatMessage[];
  tokens: StyleTokens;
  style: ChatStyle;
  contactName: string;
  contactImage?: string;
  /** Whether to show the typing indicator after the last message. */
  showTypingIndicator: boolean;
  /** Animation frame for the typing indicator (0–17). */
  typingFrame?: number;
}

export function ExportMessageList({
  messages,
  tokens,
  style,
  contactName,
  contactImage,
  showTypingIndicator,
  typingFrame,
}: ExportMessageListProps) {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: tokens.chatBg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Spacer pushes messages to bottom */}
      <div style={{ flex: 1 }} />

      {/* Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, paddingBottom: 12 }}>
        {messages.map((msg) => (
          <ExportBubble
            key={msg.id}
            message={msg}
            tokens={tokens}
            style={style}
            contactName={contactName}
            contactImage={contactImage}
          />
        ))}

        {/* Typing indicator */}
        {showTypingIndicator && typingFrame !== undefined && (
          <ExportTypingIndicator typingFrame={typingFrame} tokens={tokens} />
        )}
      </div>
    </div>
  );
}
