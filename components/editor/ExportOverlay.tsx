/**
 * Full-screen export progress overlay.
 *
 * Shown during video generation. Displays circular progress,
 * percentage, status text, and cancel button.
 * Supports Escape key to cancel and traps focus.
 */

'use client';

import { useEffect, useRef } from 'react';

interface ExportOverlayProps {
  progress: number;
  statusText: string;
  onCancel: () => void;
}

export function ExportOverlay({ progress, statusText, onCancel }: ExportOverlayProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeOffset = circumference - (progress / 100) * circumference;
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on mount + handle Escape
  useEffect(() => {
    cancelRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Export progress"
    >
      {/* Cancel button */}
      <button
        ref={cancelRef}
        onClick={onCancel}
        className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        aria-label="Cancel export"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="flex flex-col items-center gap-6 px-6">
        {/* Circular progress */}
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="5"
            />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-semibold text-white tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg font-medium text-white">Generating Video</h2>

        {/* Status text */}
        <p className="text-sm text-gray-400 text-center min-h-[20px]">{statusText}</p>

        {/* Linear progress bar */}
        <div className="w-56 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${progress}%`, transition: 'width 0.4s ease-out' }}
          />
        </div>
      </div>
    </div>
  );
}
