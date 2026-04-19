/**
 * Chat editor — Obsidian Gold 3-column layout.
 *
 * Left sidebar: studio nav with drafts/characters/layouts/assets/export.
 * Center stage: phone preview with ambient gold glow + playback controls.
 * Right panel: platform preset, dialogue input, character selection.
 * All right-panel controls wire to the Zustand chat store.
 */

'use client';

import { useState, useRef, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useChatStore } from '@/store/chat-store';
import { PhonePreview } from '@/components/editor/PhonePreview';
import { ExportButton } from '@/components/editor/ExportButton';
import { ExportOverlay } from '@/components/editor/ExportOverlay';
import type { ChatStyle, ExportJob } from '@/lib/types';

const SIDEBAR_ITEMS = ['Drafts', 'Characters', 'Layouts', 'Assets', 'Export'] as const;

const PLATFORMS: { key: ChatStyle; label: string }[] = [
  { key: 'imessage', label: 'iMessage' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

export function ChatEditor() {
  const messages = useChatStore((s) => s.messages);
  const style = useChatStore((s) => s.style);
  const currentSender = useChatStore((s) => s.currentSender);
  const addMessage = useChatStore((s) => s.addMessage);
  const addImageMessage = useChatStore((s) => s.addImageMessage);
  const toggleSender = useChatStore((s) => s.toggleSender);
  const setStyle = useChatStore((s) => s.setStyle);

  const contact = useChatStore((s) => s.contact);
  const setContact = useChatStore((s) => s.setContact);

  const [activeNav, setActiveNav] = useState<string>('Characters');
  const [text, setText] = useState('');
  const [contactName, setContactName] = useState(contact.name);
  const [editingContact, setEditingContact] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Auto-focus textarea on mount. */
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    addMessage(text);
    setText('');
    textareaRef.current?.focus();
  }

  function handleContactSave() {
    setContact({ name: contactName || 'Jane' });
    setEditingContact(false);
  }

  /** Upload an image file and add it as an image message. */
  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    setImageError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { error?: string }).error || 'Upload failed');
      }

      const { url, width, height } = await res.json() as {
        url: string;
        width: number;
        height: number;
      };
      addImageMessage(url, width, height);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setImageError(msg);
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  /** Trigger the full export pipeline. */
  const handleExport = useCallback(async () => {
    if (messages.length === 0) return;
    setExporting(true);
    setExportProgress(0);
    setExportStatus('Starting export...');

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: { messages, contact, style } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');
      const { jobId } = data as { jobId: string };

      pollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`/api/export/${jobId}`);
          if (!sr.ok) return;
          const job = await sr.json() as ExportJob;
          setExportProgress(job.progress);
          setExportStatus(
            job.status === 'compiling' ? 'Compiling timeline...' :
            job.status === 'rendering' ? 'Capturing frames...' :
            job.status === 'encoding' ? 'Encoding video...' :
            job.status === 'complete' ? 'Complete!' : 'Processing...'
          );
          if (job.status === 'complete') {
            clearInterval(pollRef.current!); pollRef.current = null;
            setExporting(false);
            const a = document.createElement('a');
            a.href = job.downloadUrl; a.download = `textstory-${jobId}.mp4`; a.click();
          } else if (job.status === 'error') {
            clearInterval(pollRef.current!); pollRef.current = null;
            setExporting(false);
          }
        } catch { /* retry */ }
      }, 1000);
    } catch {
      setExporting(false);
    }
  }, [messages, contact, style]);

  const isYou = currentSender === 'you';

  return (
    <div className="flex h-full">
      {/* Export overlay */}
      {exporting && (
        <ExportOverlay
          progress={exportProgress}
          statusText={exportStatus}
          onCancel={() => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            setExporting(false);
          }}
        />
      )}

      {/* ── Left Sidebar ── */}
      <aside className="w-64 bg-[#1c1b1b] flex flex-col shrink-0">
        {/* Studio header */}
        <div className="px-5 pt-6 pb-4">
          <h2
            className="text-xs font-bold tracking-[0.2em] text-[#ffd13d]"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            STUDIO
          </h2>
          <p
            className="text-[11px] text-[#d2c5ad] mt-1"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            Premium Editor
          </p>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 px-0 pr-4 mt-2">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item === activeNav;
            return (
              <button
                key={item}
                onClick={() => setActiveNav(item)}
                className={`text-left pl-5 py-2.5 text-sm font-medium transition-all cursor-pointer border-none rounded-r-full ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ffd13d] to-[#e2b500] text-[#131313]'
                    : 'text-[#d2c5ad] hover:bg-[#3a3939] bg-transparent'
                }`}
                style={{ fontFamily: 'var(--font-inter)' }}
              >
                {item}
              </button>
            );
          })}
        </nav>

        {/* Bottom — new project button */}
        <div className="mt-auto px-4 pb-5">
          <button
            className="w-full py-2.5 rounded-lg text-sm font-medium text-[#d2c5ad] bg-[#2a2a2a] border border-[#4e4634] hover:bg-[#3a3939] transition-colors cursor-pointer"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            + New Project
          </button>
        </div>
      </aside>

      {/* ── Center Stage ── */}
      <main className="flex-1 bg-[#131313] flex flex-col items-center justify-center relative overflow-hidden min-w-0">
        {/* Ambient gold glow */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,209,61,0.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Phone preview */}
        <div className="relative z-10">
          <PhonePreview />
        </div>

        {/* Floating controls below phone */}
        <div className="flex items-center gap-4 mt-6 relative z-10">
          {/* Replay */}
          <button
            className="w-10 h-10 rounded-full bg-[#2a2a2a] border border-[#4e4634] flex items-center justify-center text-[#d2c5ad] hover:bg-[#3a3939] transition-colors cursor-pointer"
            aria-label="Replay"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          {/* Play — gold */}
          <button
            className="w-12 h-12 rounded-full bg-gradient-to-r from-[#ffd13d] to-[#e2b500] flex items-center justify-center text-[#3d2f00] hover:brightness-110 transition-all cursor-pointer border-none"
            aria-label="Play"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={messages.length === 0}
            className="w-10 h-10 rounded-full bg-[#2a2a2a] border border-[#4e4634] flex items-center justify-center text-[#d2c5ad] hover:bg-[#3a3939] transition-colors cursor-pointer disabled:opacity-30"
            aria-label="Export video"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </main>

      {/* ── Right Panel ── */}
      <aside className="w-[400px] bg-[#201f1f] flex flex-col shrink-0 overflow-y-auto">
        <div className="p-5 space-y-6">
          {/* Platform Preset */}
          <section>
            <h3
              className="text-xs font-bold tracking-[0.2em] text-[#d2c5ad] mb-3"
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              PLATFORM PRESET
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map(({ key, label }) => {
                const isSelected = style === key;
                return (
                  <button
                    key={key}
                    onClick={() => setStyle(key)}
                    className={`p-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[#ffd13d] bg-[#2a2a2a] text-[#e5e2e1]'
                        : 'border border-[#4e4634] bg-[#1c1b1b] text-[#d2c5ad] hover:bg-[#2a2a2a]'
                    }`}
                    style={{ fontFamily: 'var(--font-inter)' }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Add Dialogue */}
          <section>
            <h3
              className="text-xs font-bold tracking-[0.2em] text-[#d2c5ad] mb-3"
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              ADD DIALOGUE
            </h3>
            <form onSubmit={handlePost} className="space-y-3">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type what the character says..."
                maxLength={500}
                rows={3}
                className="w-full rounded-lg p-3 text-sm resize-none outline-none bg-[#1c1b1b] border border-[#4e4634] text-[#e5e2e1] placeholder:text-[#d2c5ad]/50 focus:border-[#ffd13d] transition-colors"
                style={{ fontFamily: 'var(--font-inter)' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePost(e);
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="flex-1 py-2.5 rounded-lg font-bold text-sm text-[#3d2f00] bg-gradient-to-r from-[#ffd13d] to-[#e2b500] hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer border-none"
                  style={{ fontFamily: 'var(--font-inter)' }}
                >
                  POST
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-[#d2c5ad] bg-[#2a2a2a] border border-[#4e4634] hover:bg-[#3a3939] disabled:opacity-40 transition-colors cursor-pointer"
                  title="Add image"
                  aria-label="Add image"
                >
                  {imageUploading ? (
                    <span className="text-xs">...</span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  )}
                </button>
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
              {imageError && (
                <p className="text-red-400 text-xs mt-1">{imageError}</p>
              )}
            </form>
          </section>

          {/* Characters */}
          <section>
            <h3
              className="text-xs font-bold tracking-[0.2em] text-[#d2c5ad] mb-3"
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              CHARACTERS
            </h3>
            <div className="space-y-2">
              {/* You */}
              <button
                onClick={() => { if (!isYou) toggleSender(); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer border-none bg-transparent hover:bg-[#2a2a2a]"
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isYou ? 'border-[#ffd13d]' : 'border-[#4e4634]'
                  }`}
                >
                  {isYou && <span className="w-2 h-2 rounded-full bg-[#ffd13d]" />}
                </span>
                <span
                  className={`text-sm font-medium ${isYou ? 'text-[#e5e2e1]' : 'text-[#d2c5ad]'}`}
                  style={{ fontFamily: 'var(--font-inter)' }}
                >
                  You
                </span>
              </button>

              {/* Friend — with editable name */}
              <div className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a2a2a] transition-all">
                <button
                  onClick={() => { if (isYou) toggleSender(); }}
                  className="flex items-center gap-3 cursor-pointer border-none bg-transparent flex-1 min-w-0"
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      !isYou ? 'border-[#ffd13d]' : 'border-[#4e4634]'
                    }`}
                  >
                    {!isYou && <span className="w-2 h-2 rounded-full bg-[#ffd13d]" />}
                  </span>
                  {editingContact ? (
                    <input
                      autoFocus
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      onBlur={handleContactSave}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleContactSave(); }}
                      maxLength={30}
                      className="w-full text-sm font-medium bg-[#1c1b1b] border border-[#ffd13d] rounded px-2 py-0.5 text-[#e5e2e1] outline-none"
                      style={{ fontFamily: 'var(--font-inter)' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={`text-sm font-medium truncate ${!isYou ? 'text-[#e5e2e1]' : 'text-[#d2c5ad]'}`}
                      style={{ fontFamily: 'var(--font-inter)' }}
                    >
                      {contact.name}
                    </span>
                  )}
                </button>
                {!editingContact && (
                  <button
                    onClick={() => { setContactName(contact.name); setEditingContact(true); }}
                    className="text-[#4e4634] hover:text-[#ffd13d] transition-colors cursor-pointer bg-transparent border-none shrink-0"
                    title="Edit name"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* New character button */}
            <button
              className="w-full mt-3 py-2.5 rounded-lg text-sm font-medium text-[#d2c5ad] bg-transparent border border-dashed border-[#4e4634] hover:border-[#ffd13d] hover:text-[#ffd13d] transition-colors cursor-pointer"
              style={{ fontFamily: 'var(--font-inter)' }}
            >
              + NEW CHARACTER
            </button>
          </section>

          {/* Message count indicator */}
          {messages.length > 0 && (
            <p className="text-xs text-[#d2c5ad]/60 text-center" style={{ fontFamily: 'var(--font-inter)' }}>
              {messages.length} message{messages.length !== 1 ? 's' : ''} in conversation
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
