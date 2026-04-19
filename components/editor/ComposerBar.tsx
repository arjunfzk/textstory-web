/**
 * Text input + send button + sender toggle.
 *
 * Compact sender toggle [You | Friend] above the text input.
 */

'use client';

import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { useChatStore } from '@/store/chat-store';

export function ComposerBar({ inputRef: externalRef }: { inputRef?: RefObject<HTMLInputElement | null> }) {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = externalRef ?? internalRef;
  const [text, setText] = useState('');
  const addMessage = useChatStore((s) => s.addMessage);
  const currentSender = useChatStore((s) => s.currentSender);
  const toggleSender = useChatStore((s) => s.toggleSender);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    addMessage(text);
    setText('');
    ref.current?.focus();
  }

  const isYou = currentSender === 'you';

  return (
    <div className="space-y-2.5">
      {/* Sender toggle */}
      <div className="flex justify-center">
        <div
          className="inline-flex rounded-full p-0.5"
          style={{ background: 'var(--surface-raised)' }}
        >
          <button
            type="button"
            onClick={() => { if (!isYou) toggleSender(); }}
            className="px-4 py-1 rounded-full text-[12px] font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: isYou ? 'var(--action)' : 'transparent',
              color: isYou ? '#fff' : 'var(--text-secondary)',
            }}
          >
            You
          </button>
          <button
            type="button"
            onClick={() => { if (isYou) toggleSender(); }}
            className="px-4 py-1 rounded-full text-[12px] font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: !isYou ? 'var(--success)' : 'transparent',
              color: !isYou ? '#fff' : 'var(--text-secondary)',
            }}
          >
            Friend
          </button>
        </div>
      </div>

      {/* Input + send */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={ref}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Type as ${isYou ? 'You' : 'Friend'}...`}
          autoFocus
          maxLength={500}
          className="flex-1 rounded-lg px-3.5 py-2 text-[13px] outline-none transition-colors"
          style={{
            background: 'var(--surface-input)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
          style={{ background: 'var(--action)' }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--action-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--action)'; }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
