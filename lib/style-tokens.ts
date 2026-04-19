/**
 * Style token definitions for each chat style.
 *
 * Both editor and export components import these tokens to guarantee
 * visual parity. Tokens are pure data — no React, no side effects.
 *
 * Font families use CSS custom properties set by next/font in layout.tsx
 * so the same physical font is used in both the editor and the Docker
 * container's headless Chrome. The /render page must also declare these
 * CSS variables via @font-face for Puppeteer parity.
 */

import type { ChatStyle, StyleTokens } from '@/lib/types';

export const IMESSAGE_TOKENS: StyleTokens = {
  name: 'iMessage',
  headerBg: '#FFFFFF',
  headerText: '#000000',
  chatBg: '#F2F2F7',
  youBubbleBg: '#007AFF',
  youBubbleText: '#FFFFFF',
  friendBubbleBg: '#E5E5EA',
  friendBubbleText: '#000000',
  bubbleRadius: 18,
  fontFamily: "var(--font-inter), 'Inter', system-ui, -apple-system, sans-serif",
  fontSize: 16,
  avatarSize: 36,
  showAvatarOnBubble: false,
  typingIndicatorBg: '#E5E5EA',
};

export const WHATSAPP_TOKENS: StyleTokens = {
  name: 'WhatsApp',
  headerBg: '#075E54',
  headerText: '#FFFFFF',
  chatBg: '#ECE5DD',
  youBubbleBg: '#DCF8C6',
  youBubbleText: '#000000',
  friendBubbleBg: '#FFFFFF',
  friendBubbleText: '#000000',
  bubbleRadius: 8,
  fontFamily: "var(--font-roboto), 'Roboto', 'Helvetica Neue', sans-serif",
  fontSize: 15,
  avatarSize: 40,
  showAvatarOnBubble: false,
  typingIndicatorBg: '#FFFFFF',
};

export const INSTAGRAM_TOKENS: StyleTokens = {
  name: 'Instagram',
  headerBg: '#FFFFFF',
  headerText: '#262626',
  chatBg: '#FFFFFF',
  youBubbleBg: '#3797F0',
  youBubbleText: '#FFFFFF',
  friendBubbleBg: '#EFEFEF',
  friendBubbleText: '#262626',
  bubbleRadius: 22,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: 15,
  avatarSize: 28,
  showAvatarOnBubble: true,
  typingIndicatorBg: '#EFEFEF',
};

/** Look up style tokens by chat style key. */
export const STYLE_TOKENS: Record<ChatStyle, StyleTokens> = {
  imessage: IMESSAGE_TOKENS,
  whatsapp: WHATSAPP_TOKENS,
  instagram: INSTAGRAM_TOKENS,
};
