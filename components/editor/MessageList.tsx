/**
 * Editable message list in the editor panel.
 *
 * Each message shows sender badge, text preview, and reorder/delete actions.
 */

'use client';

import { useChatStore } from '@/store/chat-store';
import { MessageActions } from '@/components/editor/MessageActions';

export function MessageList() {
  const messages = useChatStore((s) => s.messages);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center mb-2.5"
          style={{ background: 'var(--surface-overlay)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No messages yet</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Add a message below to start</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto editor-scroll">
      {messages.map((msg, idx) => (
        <div
          key={msg.id}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-raised)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {/* Sender badge */}
          <span
            className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
            style={{
              background: msg.sender === 'you' ? 'var(--action-muted)' : 'var(--success-muted)',
              color: msg.sender === 'you' ? 'var(--action)' : 'var(--success)',
            }}
          >
            {msg.sender === 'you' ? 'You' : 'Them'}
          </span>

          {/* Message text */}
          <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
            {msg.kind === 'text' ? msg.text : ''}
          </span>

          {/* Actions */}
          <MessageActions
            messageId={msg.id}
            isFirst={idx === 0}
            isLast={idx === messages.length - 1}
          />
        </div>
      ))}
    </div>
  );
}
