# TextStory Web — Session Handoff

**Date:** 2026-04-19
**Branch:** main
**Commit:** d7ccdb8
**Repo:** https://github.com/arjunfzk/textstory-web
**Tests:** 30 passing | 0 type errors | Production build clean

## What Was Done This Session

### Image Messages (complete)
Added discriminated union `ChatMessage = TextMessage | ImageMessage` with `kind` field. Full pipeline support:
- Types, store (with localStorage migration v1→v2), editor bubble, export bubble
- Timeline compiler: images skip typing, have pre-appear delay (333ms friend, 250ms you)
- New `/api/upload-image` endpoint (aspect-ratio preserved, returns dimensions)
- Image upload button in editor Add Dialogue section
- Zod discriminated union validation in export API
- 5 new timeline compiler tests

### Timing Overhaul (Codex-recommended)
Replaced all timing constants with TikTok/Reels-optimized values:
- Friend typing: sqrt curve `clamp(650 + 140*sqrt(chars) + 8*chars, 700, 2600)ms` (was linear 300-1000ms)
- Snappier: 0.5s breathing gap (was 1s), 125ms/char typing (was 167ms), 0.46s send pause (was 0.8s)
- Slower dot cycle: 0.75s (was 0.5s) — less twitchy
- Image pre-appear delays for realistic feel

### Export Fixes
- Send button arrow icon in export composer (was empty circle)
- Hidden Next.js dev overlay in Puppeteer render page
- Full call/video/FaceTime icons in export headers (iMessage, WhatsApp, Instagram)
- Async fs operations in exports route (was sync)

### UI Polish — Match Stitch Reference
Editor:
- Sidebar nav icons (pencil, users, grid, gallery, upload)
- Golden mic studio logo
- Platform preset buttons with icons (chat bubble, phone, camera)
- Add Dialogue: emoji + image icons left, compact POST pill right
- Character avatars with colored circles (red F, teal J)
- Video camera export button icon

Landing page:
- Full navbar (Features, Showcase, Pricing, Editor, Login, Start Exporting)
- "SIMULATION ENGINE" section label
- Typing dots icon in Realistic Typing card
- Video camera icon in Screen Recording Export card
- Polished testimonial avatars with gradient backgrounds
- Footer tagline "HIGH-FIDELITY SIMULATIONS"

### Codex Review Fixes
- Removed 8 dead components + 6 AI artifact docs (-2,951 lines)
- Added MIT LICENSE file
- SSRF fix: imageUrl/profileImageUrl restricted to `/api/upload/` paths
- Text length limit (2000 chars) in export Zod schema
- UUID validation on upload serving route
- Instagram added to platform selector
- Fixed dead footer links

## What's Left

### Phase 7 — Polish & Deploy (next priority)
1. **Auth & rate limiting** — No auth on any endpoint currently. Export is expensive (Puppeteer + FFmpeg). Need at minimum rate limiting, ideally simple auth.
2. **Temp file cleanup** — Uploads and export artifacts never get cleaned up. Need TTL-based cleanup (uploads 24h, exports 1h, jobs 2h).
3. **Error toasts** — Upload and export errors show inline text. Need proper toast notifications.
4. **Responsive layout** — Editor is desktop-only. Needs mobile stack layout.
5. **Edge cases** — Empty message validation in the store (currently silently rejects), very long message handling, special character edge cases.
6. **Docker build verification** — Dockerfile exists but hasn't been tested end-to-end recently.
7. **VPS deployment + SSL** — Docker Compose + Nginx config ready, needs actual deployment.

### Visual Polish (nice-to-have)
- Hero phone mockup could have a dramatic camera lens/glass texture behind it (like Stitch reference)
- Testimonials could use real profile photos instead of initial circles
- "Features" nav link should be underlined gold when on landing page

### Future Features
- Multi-character support (currently only "you" + one friend)
- Delete/reorder messages in the editor
- WhatsApp group chat mode
- Undo/redo
- Draft management (save/load multiple conversations)

## Key Learnings

1. **Tailwind v4 CSS variable gotcha**: `bg-[--surface-base]` doesn't work. Must use inline `style={{ backgroundColor: 'var(--surface-base)' }}`.
2. **Puppeteer frame ack**: Double-rAF (`rAF(() => rAF(() => signal))`) required before screenshot.
3. **`__setFrame` before `__READY__`**: Both must be registered in the same useEffect to prevent race condition.
4. **Export components**: Must use inline styles (not Tailwind) and plain `<img>` (not next/image) for Puppeteer determinism.
5. **Sqrt typing curve**: Linear scaling feels wrong for long messages. `650 + 140*sqrt(n) + 8*n` feels natural.
6. **`position: relative`** needed on export image wrapper for border-radius clipping in headless Chrome.
7. **Zustand migrations**: Use immutable spread (don't mutate `persisted`), exact version guard (`=== 1` not `< 2`).

## Architecture Rules (Don't Violate)

- `lib/` NEVER imports from `components/`, `store/`, or `app/`
- Export components use inline styles (not Tailwind) for Puppeteer determinism
- Export components use plain `<img>` (NOT next/image)
- TimelineCompiler is a pure function — no side effects, no browser APIs
- Frame acknowledgement uses `window.__RENDERED_FRAME_ID__` (frame ID string, not boolean)
- Export snapshot isolation: deep-copy conversation at submit time via `structuredClone()`
- `imageUrl` restricted to `/api/upload/` prefix — never accept external URLs

## Dev Commands

```bash
npm run dev      # Landing at :3000, editor at :3000/editor
npm test         # 30 tests (vitest)
npm run build    # Production build
npx tsc --noEmit # Type check
```
