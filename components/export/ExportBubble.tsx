/**
 * Static message bubble for Puppeteer frame capture.
 *
 * Style-specific bubble shapes:
 * - iMessage: rounded with tail corner, blue/gray
 * - WhatsApp: small radius with tail, green/white, timestamps
 * - Instagram: pill-shaped, blue/gray
 *
 * Uses plain <img> (NOT next/image) for Puppeteer compatibility.
 */

import type { ChatMessage, ChatStyle, StyleTokens } from '@/lib/types';

interface ExportBubbleProps {
  message: ChatMessage;
  tokens: StyleTokens;
  style: ChatStyle;
  contactName: string;
  contactImage?: string;
}

export function ExportBubble({
  message,
  tokens,
  style,
  contactName,
  contactImage,
}: ExportBubbleProps) {
  const isYou = message.sender === 'you';
  const isImage = message.kind === 'image';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isYou ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        paddingLeft: 10,
        paddingRight: 10,
      }}
    >
      {/* Friend avatar (Instagram only) */}
      {!isYou && tokens.showAvatarOnBubble && (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            marginRight: 6,
            marginBottom: 2,
          }}
        >
          {contactImage ? (
            <img src={contactImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #A855F7, #EC4899)',
                color: '#FFFFFF',
              }}
            >
              {contactName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Bubble */}
      {isImage ? (
        <div
          style={{
            maxWidth: '72%',
            overflow: 'hidden',
            borderRadius: tokens.bubbleRadius,
            position: 'relative', // Required for border-radius clipping in headless Chrome
          }}
        >
          <img
            src={message.imageUrl}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              ...(message.width && message.height
                ? { aspectRatio: `${message.width} / ${message.height}` }
                : {}),
            }}
          />
        </div>
      ) : (
        <div style={getBubbleInlineStyle(style, isYou, tokens)}>
          {message.text}
          {/* WhatsApp timestamp */}
          {style === 'whatsapp' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                marginLeft: 8,
                fontSize: 10,
                opacity: 0.5,
                whiteSpace: 'nowrap',
                float: 'right',
                marginTop: 4,
              }}
            >
              10:30
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function getBubbleInlineStyle(
  style: ChatStyle,
  isYou: boolean,
  tokens: StyleTokens,
): React.CSSProperties {
  const base: React.CSSProperties = {
    maxWidth: '72%',
    backgroundColor: isYou ? tokens.youBubbleBg : tokens.friendBubbleBg,
    color: isYou ? tokens.youBubbleText : tokens.friendBubbleText,
    fontFamily: tokens.fontFamily,
    fontSize: tokens.fontSize,
    lineHeight: 1.35,
    wordBreak: 'break-word',
  };

  if (style === 'imessage') {
    return {
      ...base,
      padding: '8px 12px',
      borderRadius: 18,
      ...(isYou
        ? { borderBottomRightRadius: 4 }
        : { borderBottomLeftRadius: 4 }),
    };
  }

  if (style === 'whatsapp') {
    return {
      ...base,
      padding: '6px 8px 6px 9px',
      borderRadius: 8,
      ...(isYou
        ? { borderTopRightRadius: 0 }
        : { borderTopLeftRadius: 0 }),
      boxShadow: '0 1px 0.5px rgba(0,0,0,0.08)',
    };
  }

  // Instagram
  return {
    ...base,
    padding: '8px 14px',
    borderRadius: 22,
  };
}
