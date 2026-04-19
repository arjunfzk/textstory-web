/**
 * Action buttons for a selected message: move up, move down, delete.
 * Shown inline next to each message in the message editor list.
 */

'use client';

import { useChatStore } from '@/store/chat-store';

interface MessageActionsProps {
  messageId: string;
  isFirst: boolean;
  isLast: boolean;
}

export function MessageActions({ messageId, isFirst, isLast }: MessageActionsProps) {
  const removeMessage = useChatStore((s) => s.removeMessage);
  const moveMessage = useChatStore((s) => s.moveMessage);

  const btnClass =
    'w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs';

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => moveMessage(messageId, 'up')}
        disabled={isFirst}
        className={btnClass}
        title="Move up"
      >
        ↑
      </button>
      <button
        onClick={() => moveMessage(messageId, 'down')}
        disabled={isLast}
        className={btnClass}
        title="Move down"
      >
        ↓
      </button>
      <button
        onClick={() => removeMessage(messageId)}
        className={`${btnClass} hover:text-red-400 hover:bg-red-900/30`}
        title="Delete"
      >
        ×
      </button>
    </div>
  );
}
