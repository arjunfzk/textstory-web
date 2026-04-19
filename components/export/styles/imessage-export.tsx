/**
 * iMessage-specific export overrides for Puppeteer frame capture.
 *
 * The base ExportChatView already handles all rendering via StyleTokens.
 * This file provides iMessage-specific refinements that go beyond what
 * tokens can express — bubble tails, delivery status, timestamp styling.
 *
 * For V1, iMessage rendering is fully handled by the generic export
 * components + IMESSAGE_TOKENS. This file exists as the extension point
 * for V2 when we add delivery indicators ("Delivered", "Read") and
 * bubble tail shapes.
 */

import type { Conversation, TimelineEntry } from '@/lib/types';
import { ExportChatView } from '@/components/export/ExportChatView';

interface IMessageExportProps {
  conversation: Conversation;
  frame: TimelineEntry;
}

/**
 * iMessage export renderer.
 * Currently delegates entirely to ExportChatView with iMessage tokens.
 */
export function IMessageExport({ conversation, frame }: IMessageExportProps) {
  return <ExportChatView conversation={conversation} frame={frame} />;
}
