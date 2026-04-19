/**
 * Three compact cards for selecting the chat style.
 * Selected card gets an amber accent ring.
 */

'use client';

import { useChatStore } from '@/store/chat-store';
import type { ChatStyle } from '@/lib/types';
import { STYLE_TOKENS } from '@/lib/style-tokens';

const STYLES: { key: ChatStyle; label: string }[] = [
  { key: 'imessage', label: 'iMessage' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
];

export function StylePicker() {
  const style = useChatStore((s) => s.style);
  const setStyle = useChatStore((s) => s.setStyle);

  return (
    <div className="flex gap-2">
      {STYLES.map(({ key, label }) => {
        const tokens = STYLE_TOKENS[key];
        const isSelected = style === key;

        return (
          <button
            key={key}
            onClick={() => setStyle(key)}
            className="flex-1 rounded-lg p-2.5 text-center text-[12px] font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: isSelected ? 'var(--surface-overlay)' : 'var(--surface-raised)',
              border: isSelected ? '1.5px solid var(--accent)' : '1.5px solid var(--border-subtle)',
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: isSelected ? '0 0 16px var(--accent-muted)' : 'none',
            }}
          >
            <div className="flex justify-center gap-1.5 mb-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tokens.youBubbleBg, boxShadow: '0 0 0 1px oklch(1 0 0 / 0.08)' }}
              />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tokens.friendBubbleBg, boxShadow: '0 0 0 1px oklch(0 0 0 / 0.1)' }}
              />
            </div>
            {label}
          </button>
        );
      })}
    </div>
  );
}
