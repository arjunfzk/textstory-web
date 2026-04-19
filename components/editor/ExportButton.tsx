/**
 * Export Video button with progress overlay.
 *
 * Submits the conversation to POST /api/export, then polls
 * GET /api/export/[jobId] every second until complete or error.
 * Shows full-screen ExportOverlay during generation.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/chat-store';
import { ExportOverlay } from '@/components/editor/ExportOverlay';
import type { ExportJob, ExportStatus } from '@/lib/types';

/** Human-readable status labels. */
function formatStatus(status: ExportStatus): string {
  switch (status) {
    case 'queued': return 'Waiting in queue...';
    case 'compiling': return 'Compiling timeline...';
    case 'rendering': return 'Capturing frames...';
    case 'encoding': return 'Encoding video...';
    case 'complete': return 'Complete!';
    case 'error': return 'Export failed';
  }
}

export function ExportButton({ compact = false }: { compact?: boolean }) {
  const messages = useChatStore((s) => s.messages);
  const contact = useChatStore((s) => s.contact);
  const style = useChatStore((s) => s.style);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Stop polling on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setProgress(0);
    setStatusText('Starting export...');
    setError(null);

    try {
      // Submit export request with snapshot
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: { messages, contact, style },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Export failed (${res.status})`);
      }

      const { jobId } = data as { jobId: string };

      // Poll for status every second
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/export/${jobId}`);
          if (!statusRes.ok) return;

          const job = await statusRes.json() as ExportJob;
          setProgress(job.progress);
          setStatusText(formatStatus(job.status));

          if (job.status === 'complete') {
            stopPolling();
            setExporting(false);
            // Trigger download via programmatic anchor click
            const a = document.createElement('a');
            a.href = job.downloadUrl;
            a.download = `textstory-${jobId}.mp4`;
            a.click();
          } else if (job.status === 'error') {
            stopPolling();
            setExporting(false);
            setError(job.error);
          }
        } catch {
          // Network error during polling — keep retrying
        }
      }, 1000);
    } catch (err) {
      setExporting(false);
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [messages, contact, style, stopPolling]);

  const handleCancel = useCallback(() => {
    stopPolling();
    setExporting(false);
  }, [stopPolling]);

  const messageCount = messages.length;

  return (
    <>
      <button
        disabled={messageCount === 0 || exporting}
        className={`rounded-lg font-semibold text-white transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed ${
          compact ? 'w-full py-1.5 text-[12px]' : 'w-full py-2.5 text-[13px]'
        }`}
        style={{ background: 'var(--accent)' }}
        onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--accent-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        onClick={handleExport}
      >
        {exporting
          ? 'Exporting...'
          : compact
            ? 'Export'
            : `Export Video${messageCount > 0 ? ` (${messageCount})` : ''}`
        }
      </button>

      {error && !compact && (
        <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      {exporting && (
        <ExportOverlay
          progress={progress}
          statusText={statusText}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
