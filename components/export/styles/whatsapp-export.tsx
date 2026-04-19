/**
 * WhatsApp-specific export renderer stub.
 *
 * V1: delegates to ExportChatView which applies WHATSAPP_TOKENS.
 * V2: adds WhatsApp-specific UI (double-check marks, timestamps,
 * wallpaper background pattern, green header bar styling).
 */

import type { Conversation, TimelineEntry } from '@/lib/types';
import { ExportChatView } from '@/components/export/ExportChatView';

interface WhatsAppExportProps {
  conversation: Conversation;
  frame: TimelineEntry;
}

export function WhatsAppExport({ conversation, frame }: WhatsAppExportProps) {
  return <ExportChatView conversation={conversation} frame={frame} />;
}
