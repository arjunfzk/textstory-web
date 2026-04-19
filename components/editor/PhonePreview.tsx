/**
 * Phone-shaped preview container for the chat UI.
 *
 * Renders at 414x896 (iPhone 14/15) inside a bezel frame.
 * Uses CSS transform: scale() to fit the container responsively.
 * Shows style-specific header, message bubbles, and composer bar.
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/store/chat-store';
import { STYLE_TOKENS } from '@/lib/style-tokens';
import { ChatHeader } from '@/components/editor/ChatHeader';
import { MessageBubble } from '@/components/editor/MessageBubble';
import type { ChatStyle, StyleTokens } from '@/lib/types';

const PHONE_WIDTH = 414;
const PHONE_HEIGHT = 896;

export function PhonePreview() {
  const messages = useChatStore((s) => s.messages);
  const contact = useChatStore((s) => s.contact);
  const style = useChatStore((s) => s.style);
  const tokens = STYLE_TOKENS[style];

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return;
      const parent = containerRef.current.parentElement;
      if (!parent) return;
      const maxW = parent.clientWidth - 32;
      const maxH = parent.clientHeight - 32;
      const s = Math.min(maxW / PHONE_WIDTH, maxH / PHONE_HEIGHT, 1);
      setScale(s);
    }
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="flex items-center justify-center h-full">
      <div
        ref={containerRef}
        className="rounded-[3rem] overflow-hidden"
        style={{
          width: PHONE_WIDTH,
          height: PHONE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          border: '3px solid oklch(0.30 0.008 60)',
          boxShadow: '0 0 80px oklch(0.20 0.02 75 / 0.25), 0 20px 60px oklch(0 0 0 / 0.4)',
        }}
      >
        {/* Status bar + header — single background to avoid seam line */}
        <div style={{ backgroundColor: tokens.headerBg }} className="shrink-0 relative">
          {/* Dynamic Island — absolute positioned, overlaps status bar */}
          <div className="h-12 flex items-end justify-center pb-1 relative">
            <div className="w-[120px] h-[32px] rounded-[16px] bg-black" />
          </div>
          <ChatHeader contact={contact} tokens={tokens} style={style} />
        </div>

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className="overflow-y-auto"
          style={{
            backgroundColor: tokens.chatBg,
            height: PHONE_HEIGHT - 48 - 52 - 56, // status bar + header + composer
          }}
        >
          <div className="py-3 space-y-1.5">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                tokens={tokens}
                style={style}
                contactName={contact.name}
                contactImage={contact.profileImageUrl}
              />
            ))}
          </div>
        </div>

        {/* Style-specific composer bar */}
        <PreviewComposer style={style} tokens={tokens} />
      </div>
    </div>
  );
}

/** Style-specific visual composer (non-interactive, preview only). */
function PreviewComposer({ style, tokens }: { style: ChatStyle; tokens: StyleTokens }) {
  if (style === 'whatsapp') {
    return (
      <div
        className="h-14 flex items-center px-2 gap-2"
        style={{ backgroundColor: tokens.chatBg }}
      >
        {/* Emoji icon */}
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[#8696A0]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" /></svg>
        </div>
        {/* Text input */}
        <div className="flex-1 h-9 rounded-full bg-white border border-[#E0E0E0] flex items-center px-3 text-[13px] text-gray-400">
          Type a message
        </div>
        {/* Attachment icon */}
        <div className="w-7 h-7 flex items-center justify-center text-[#8696A0]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" /></svg>
        </div>
        {/* Mic icon */}
        <div className="w-10 h-10 rounded-full bg-[#00A884] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
        </div>
      </div>
    );
  }

  if (style === 'instagram') {
    return (
      <div
        className="h-14 flex items-center px-3 gap-2"
        style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #EFEFEF' }}
      >
        {/* Camera icon */}
        <div className="w-9 h-9 rounded-full border-2 border-[#3797F0] flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#3797F0"><path d="M12 15c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm8-9h-3.17L15 4H9L7.17 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" /></svg>
        </div>
        {/* Text input */}
        <div className="flex-1 h-9 rounded-full border border-gray-300 flex items-center px-3 text-[13px] text-gray-400">
          Message...
        </div>
        {/* Heart + image icons */}
        <div className="flex items-center gap-3 text-[#262626]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
        </div>
      </div>
    );
  }

  // iMessage
  return (
    <div
      className="h-14 flex items-center px-3 gap-2"
      style={{ backgroundColor: '#F6F6F6', borderTop: '1px solid #E0E0E0' }}
    >
      {/* Camera icon */}
      <div className="w-8 h-8 flex items-center justify-center text-[#8E8E93]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm8-9h-3.17L15 4H9L7.17 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" /></svg>
      </div>
      {/* App Store icon */}
      <div className="w-8 h-8 flex items-center justify-center text-[#8E8E93]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 13h-5v5c0 .55-.45 1-1 1s-1-.45-1-1v-5H6c-.55 0-1-.45-1-1s.45-1 1-1h5V6c0-.55.45-1 1-1s1 .45 1 1v5h5c.55 0 1 .45 1 1s-.45 1-1 1z" /></svg>
      </div>
      {/* Text input */}
      <div className="flex-1 h-8 rounded-full border border-[#C7C7CC] bg-white flex items-center px-3 text-[13px] text-gray-400">
        iMessage
      </div>
      {/* Send arrow */}
      <div className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
      </div>
    </div>
  );
}
