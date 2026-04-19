/**
 * Puppeteer render target page.
 *
 * This page is NOT meant for direct user access. It is loaded by the
 * video export pipeline in a headless browser. Puppeteer controls it
 * frame-by-frame via window.__setFrame() to capture screenshots.
 *
 * Data flow:
 *   1. Puppeteer calls evaluateOnNewDocument to set __TEXTSTORY_DATA__
 *   2. Page mounts and reads conversation data
 *   3. Page sets window.__READY__ = true
 *   4. Puppeteer calls window.__setFrame(entry)
 *   5. React re-renders, sets window.__RENDERED_FRAME_ID__ = entry.id
 *   6. Puppeteer polls __RENDERED_FRAME_ID__ === entry.id, then screenshots
 *
 * Frame acknowledgement uses the frame ID (not a boolean) so Puppeteer
 * can correlate which frame has actually been painted to the DOM.
 *
 * Phase 3: renders ExportChatView with full chat UI.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Conversation, TimelineEntry } from '@/lib/types';
import { ExportChatView } from '@/components/export/ExportChatView';

/** Extend window with the Puppeteer control API. */
declare global {
  interface Window {
    __TEXTSTORY_DATA__?: Conversation;
    __setFrame?: (entry: TimelineEntry) => void;
    __READY__?: boolean;
    /** Set to the rendered frame's ID so Puppeteer can correlate. */
    __RENDERED_FRAME_ID__?: string;
  }
}

export default function RenderPage() {
  const conversationRef = useRef<Conversation | null>(null);
  const [frame, setFrame] = useState<TimelineEntry | null>(null);

  // Register frame control + conversation data in a single effect to
  // guarantee __setFrame exists before __READY__ is set (Critical fix #2)
  const handleSetFrame = useCallback((entry: TimelineEntry) => {
    window.__RENDERED_FRAME_ID__ = undefined;
    setFrame(entry);
  }, []);

  useEffect(() => {
    if (window.__TEXTSTORY_DATA__) {
      conversationRef.current = window.__TEXTSTORY_DATA__;
    }

    window.__setFrame = handleSetFrame;

    // Signal ready AFTER __setFrame is registered so Puppeteer never
    // calls __setFrame before it exists
    window.__READY__ = true;
  }, [handleSetFrame]);

  // Signal frame render complete — correlate by frame ID.
  // Double-rAF ensures at least one paint cycle has occurred so
  // Puppeteer screenshots the committed DOM, not a stale frame (Critical fix #1)
  useEffect(() => {
    if (frame) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.__RENDERED_FRAME_ID__ = frame.id;
        });
      });
    }
  }, [frame]);

  const conversation = conversationRef.current;

  return (
    <>
      {/* Hide Next.js dev indicator so Puppeteer doesn't capture it */}
      <style>{`nextjs-portal { display: none !important; }`}</style>
      <div
        id="capture-root"
        style={{
          width: 414,
          height: 896,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#F2F2F7',
        }}
      >
      {conversation && frame ? (
        <ExportChatView conversation={conversation} frame={frame} />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          Waiting for data...
        </div>
      )}
    </div>
    </>
  );
}
