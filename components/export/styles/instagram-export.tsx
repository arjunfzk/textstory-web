/**
 * Instagram DM-specific export renderer stub.
 *
 * V1: delegates to ExportChatView which applies INSTAGRAM_TOKENS.
 * V2: adds Instagram-specific UI (gradient send bubbles, heart reactions,
 * "Seen" indicator, profile photo next to incoming messages).
 */

import type { Conversation, TimelineEntry } from '@/lib/types';
import { ExportChatView } from '@/components/export/ExportChatView';

interface InstagramExportProps {
  conversation: Conversation;
  frame: TimelineEntry;
}

export function InstagramExport({ conversation, frame }: InstagramExportProps) {
  return <ExportChatView conversation={conversation} frame={frame} />;
}
