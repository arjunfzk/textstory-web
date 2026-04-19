/**
 * Single chat message bubble in the phone preview.
 *
 * Renders style-specific bubbles:
 * - iMessage: rounded with tail on sender side, blue/gray
 * - WhatsApp: smaller radius with tail, green/white, timestamps
 * - Instagram: pill-shaped, gradient blue/gray
 */

'use client';

import type { ChatMessage, ChatStyle, StyleTokens } from '@/lib/types';

interface MessageBubbleProps {
  message: ChatMessage;
  tokens: StyleTokens;
  style: ChatStyle;
  contactName: string;
  contactImage?: string;
}

export function MessageBubble({
  message,
  tokens,
  style,
  contactName,
  contactImage,
}: MessageBubbleProps) {
  const isYou = message.sender === 'you';
  const isImage = message.kind === 'image';

  return (
    <div className={`flex ${isYou ? 'justify-end' : 'justify-start'} px-2.5`}>
      {/* Friend avatar (Instagram only) */}
      {!isYou && tokens.showAvatarOnBubble && (
        <div
          className="shrink-0 rounded-full overflow-hidden mr-1.5 mt-auto mb-0.5"
          style={{ width: 24, height: 24 }}
        >
          {contactImage ? (
            <img src={contactImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-[9px] font-bold bg-gradient-to-br from-purple-400 to-pink-400 text-white"
            >
              {contactName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Bubble with style-specific shape */}
      {isImage ? (
        <div
          className="max-w-[200px] overflow-hidden"
          style={{
            borderRadius: tokens.bubbleRadius,
          }}
        >
          <img
            src={message.imageUrl}
            alt=""
            className="block w-full h-auto"
            style={{
              ...(message.width && message.height
                ? { aspectRatio: `${message.width} / ${message.height}` }
                : {}),
            }}
          />
        </div>
      ) : (
        <div
          className="max-w-[72%] break-words relative"
          style={{
            backgroundColor: isYou ? tokens.youBubbleBg : tokens.friendBubbleBg,
            color: isYou ? tokens.youBubbleText : tokens.friendBubbleText,
            fontFamily: tokens.fontFamily,
            fontSize: tokens.fontSize,
            lineHeight: 1.35,
            ...getBubbleStyle(style, isYou),
          }}
        >
          {message.text}

          {/* WhatsApp timestamp + check marks */}
          {style === 'whatsapp' && (
            <span className="inline-flex items-center gap-0.5 ml-2 align-bottom text-[10px] opacity-50 whitespace-nowrap float-right mt-1">
              {formatTime()}
              {isYou && (
                <svg width="14" height="8" viewBox="0 0 16 8" fill="currentColor" opacity="0.7">
                  <path d="M1 4l3 3L11 1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                  <path d="M5 4l3 3L15 1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                </svg>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Returns style-specific CSS properties for the bubble shape. */
function getBubbleStyle(style: ChatStyle, isYou: boolean): React.CSSProperties {
  if (style === 'imessage') {
    return {
      padding: '8px 12px',
      borderRadius: 18,
      // Tail: sharper corner on sender side
      ...(isYou
        ? { borderBottomRightRadius: 4 }
        : { borderBottomLeftRadius: 4 }),
    };
  }

  if (style === 'whatsapp') {
    return {
      padding: '6px 8px 6px 9px',
      borderRadius: 8,
      // Tail: sharper corner on sender side
      ...(isYou
        ? { borderTopRightRadius: 0 }
        : { borderTopLeftRadius: 0 }),
      boxShadow: '0 1px 0.5px rgba(0,0,0,0.08)',
    };
  }

  // Instagram
  return {
    padding: '8px 14px',
    borderRadius: 22,
  };
}

/** Returns a static time string (visual only, not real time). */
function formatTime(): string {
  return '10:30';
}
