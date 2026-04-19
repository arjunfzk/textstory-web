# TextStory Web — Implementation Handoff

## What This Project Is

A web app that creates fake text conversations (iMessage/WhatsApp/Instagram) and exports them as MP4 videos with typing animations, sound effects, and professional timing. Port of a Flutter iOS app.

## Architecture (Decided — Don't Re-Debate)

- **Next.js 16 monolith** (App Router, TypeScript, Tailwind v4)
- **2 Docker services**: Nginx + Next.js (with Chromium + FFmpeg)
- **Server-side video**: Puppeteer frame capture + FFmpeg concat mux
- **TimelineCompiler**: pure function → deterministic frame plan
- **AudioPreMixer**: pre-mix all sounds into single 48kHz WAV
- **child_process.spawn()** for export jobs, semaphore concurrency=1
- **Two component trees**: `/components/editor/` and `/components/export/`

## What's Done (Phases 0–6)

### Phase 0 — Scaffold (commit `b28ea34`)
- Next.js project with all dependencies installed
- `lib/types.ts` — all TypeScript types (Conversation, TimelineEntry, ExportJob as discriminated union, StyleTokens)
- `lib/style-tokens.ts` — iMessage/WhatsApp/Instagram visual tokens with CSS variable font parity
- Multi-stage Dockerfile (Chromium + FFmpeg + Inter/Roboto/Noto Emoji fonts)
- Docker Compose (Nginx + Next.js) + nginx.conf
- Puppeteer render page (`/render`) with frame-ID-correlated handshake protocol
- Benchmark script (`scripts/benchmark-puppeteer.ts`)
- Vitest + happy-dom, Prettier, simple-git-hooks + nano-staged

### Phase 1 — Chat Editor UI (commit `4df7de5`)
- Zustand store (`store/chat-store.ts`) with localStorage persist + versioning
- 12 editor components in `/components/editor/`
- Two-column layout (40% editor | 60% sticky phone preview at 414x896)
- 3 style delegates via shared StyleTokens
- Profile photo upload API (`/api/upload`) with Sharp EXIF + resize + 25MP pixel limit
- Dev image serving route (`/api/upload/[sessionId]`)

### Phase 2 — TimelineCompiler (commit `93b749c`)
- `lib/timeline-compiler.ts` — pure function, Object.freeze'd constants
- Grapheme-aware via Intl.Segmenter (handles emoji, skin-tone, ZWJ)
- Removed quadratic composerText allocation — renderer derives from charsVisible
- 15 unit tests all passing (emoji, punctuation, read pause cap, determinism, 50-msg stress)

### Phase 3 — Export Render Components (commit `5c8e4a0`)
- 6 export components in `/components/export/` — deterministic, no interactivity, inline styles
- `ExportChatView.tsx` derives composerText from `splitGraphemes(msg.text).slice(0, charsVisible)`
- `ExportTypingIndicator.tsx` — frame-based dots (0–17), NOT CSS animation
- Plain `<img>` tags (NOT next/image — Puppeteer compatibility)
- Style delegate stubs for iMessage/WhatsApp/Instagram
- Updated `/app/render/page.tsx` with ExportChatView, double-rAF, and __setFrame-before-__READY__ fix
- Hoisted Intl.Segmenter to module scope for render performance

### Phase 4 — Audio Pre-Mixer (commit `8eb380a`)
- `lib/audio-premixer.ts` — PCM buffer at 48kHz (2000 samples/frame at 24fps)
- Custom WAV header writer + fmt chunk validation (sample rate, channels, bit depth)
- Sound assets converted from Flutter app (keystroke, swoosh, receive) to 48kHz WAV
- Additive mixing with clamping to prevent clipping
- 9 unit tests (WAV validity, duration, placement, clamping with synthetic overflow)

### Phase 5 — Video Pipeline (commit `82e2e5d`)
- `lib/video-pipeline.ts` — orchestrates Puppeteer + AudioPreMixer + FFmpeg
- `lib/semaphore.ts` — async FIFO semaphore with timeout + waiter cleanup
- Frame deduplication (only screenshot unique visual states)
- FFmpeg concat demuxer with per-frame duration (no duplicate PNGs)
- Settled-flag pattern prevents double-rejection in FFmpeg, bounded stderr
- Cached sound assets (loaded once, reused across exports)

### Phase 6 — API Routes + Frontend Export Flow (commit `97e2d86`)
- `POST /api/export` with Zod schema validation + structuredClone snapshot
- `GET /api/export/[jobId]` status polling (Next.js 16 async params)
- `lib/job-store.ts` — in-memory Map with 1-hour TTL auto-expire
- `ExportOverlay.tsx` — full-screen progress with SVG circular indicator
- `ExportButton.tsx` — polling loop, programmatic download, unmount cleanup
- Discriminated union ExportJob type enforced end-to-end

## What's Left (Phase 7)

### Phase 7 — Polish + Deploy
- Edge cases, responsive polish, error toasts
- Temp file cleanup (setInterval, TTL-based)
- VPS deployment + SSL

## Key Implementation Notes

- **composerText is null** in TimelineEntry — renderer must derive it:
  `splitGraphemes(message.text).slice(0, entry.charsVisible).join('')`
- **visibleMessageCount** (not visibleMessages array) — renderer slices `conversation.messages[0..count]`
- **Frame acknowledgement** uses `window.__RENDERED_FRAME_ID__` (frame ID string, not boolean) to prevent race conditions
- **Export snapshot isolation**: deep-copy conversation at submit time via `structuredClone()`
- **Module boundary**: `lib/` NEVER imports from `components/`, `store/`, or `app/`

## How to Continue

1. Read this file + `docs/brainstorms/v1-implementation-plan.md` for full details
2. Run `npm run build` to verify current state
3. Run `npm test` to verify 15 tests pass
4. Start Phase 3: Export Render Components
5. After each phase: send to Codex for review, fix findings, commit

## Codex Review Pattern

After each phase, run Codex in read-only mode:
```bash
codex exec - < review_prompt.txt -s read-only --ephemeral -m gpt-5.4 -c model_reasoning_effort=high
```
Fix all CRITICAL/HIGH findings, address MEDIUMs. Commit with findings noted.
