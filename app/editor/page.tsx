/**
 * Editor page — the chat conversation editor.
 *
 * Client-side app that renders the ChatEditor component.
 * Wrapped by editor/layout.tsx which provides the top bar shell.
 */

import { ChatEditor } from '@/components/editor/ChatEditor';

export default function EditorPage() {
  return <ChatEditor />;
}
