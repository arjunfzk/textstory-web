/**
 * Editor layout — wraps the editor page with a persistent top bar.
 *
 * Separate from the root layout so the landing page doesn't
 * load editor-specific client components.
 */

import type { Metadata } from 'next';
import { EditorTopBar } from '@/components/editor/EditorTopBar';

export const metadata: Metadata = {
  title: 'Editor — TextStory',
  description: 'Create and edit your texting story conversation.',
};

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <EditorTopBar />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
