# Multi-Model Brainstorm Report: TextStory Web MVP Architecture

## Recommended Direction

Build a **pragmatic monolith** with a **compiled timeline core**. The MVP is a Next.js app (2 Docker services: Nginx + Next.js) that handles both the interactive editor and video generation. Video export runs in a child_process with concurrency=1 using Puppeteer + FFmpeg. The intellectual center of the system is a **TimelineCompiler** — a pure TypeScript function that converts conversation JSON into a deterministic frame plan with visual states and audio events. This is the bridge between M3's "ship fast" philosophy and M2's "build correctly" philosophy: the compiler is the one abstraction worth investing in because it makes everything downstream simpler, testable, and debuggable.

**Critical prerequisite**: Before writing any product code, build a performance validation POC that benchmarks Puppeteer screenshot latency on the target VPS. This single measurement determines whether the architecture is viable. All three models flagged this as existential risk.

## Best Composite Plan

### Architecture
- **2 Docker services**: Nginx reverse proxy + Next.js (App Router, TypeScript, Tailwind)
- **No FastAPI** — all shared logic (schema, timeline, style delegates) stays in TypeScript
- **Video worker**: `child_process.spawn()` from Next.js API route, semaphore concurrency=1, 120s hard timeout
- **Image uploads**: temp storage on VPS, EXIF-corrected + resized on upload, served by Next.js static middleware, cron cleanup 24h

### Core Pipeline
```
Conversation JSON
       ↓
TimelineCompiler (pure function)
       ↓
Timeline: [{frame_range, visual_state, audio_events}]
       ↓
┌──────────┴──────────┐
│                     │
Puppeteer            AudioPreMixer
(frame capture)      (48kHz WAV)
       ↓                  ↓
  PNG frames        single WAV
       ↓                  ↓
       └──────┬───────────┘
              ↓
         FFmpeg mux
              ↓
          MP4 output
```

### Key Technical Decisions
1. **Rendering**: DOM-based React — unanimous across all models
2. **Two separate component trees**: `/components/editor/` and `/components/export/` — share TypeScript types and Tailwind classes, NOT logic
3. **TimelineCompiler**: Pure function, heavily tested, no browser dependency. Converts conversation → deterministic frame plan
4. **Audio**: Pre-mix single WAV server-side at 48kHz (2000 samples/frame at 24fps). Avoids FFmpeg filter graph explosion with 500+ keystroke sounds
5. **Pause optimization**: Hold blocks in timeline — don't duplicate PNGs. Use FFmpeg concat demuxer with explicit duration per frame
6. **Viewport**: Render at phone-width (414px), center in 1080x1920 with styled background via FFmpeg pad filter
7. **Fonts**: Bundle Inter + Noto Color Emoji in Docker container. Force-load via @font-face in both editor and render pages

## Why This Over Alternatives

**Why monolith over separate worker service (M2)?**
M2's architectural instincts are correct long-term, but for MVP on one VPS with one concurrent user, the overhead of inter-service communication, job queue infrastructure, and shared volume choreography outweighs the benefits. `child_process` already provides PID isolation, OOM-killability, and timeout enforcement. The migration path to a worker service is straightforward when needed.

**Why separate component trees over shared (M2's contract)?**
M2's "render surface contract" is the right mental model, but materializing it as shared code at MVP adds complexity without payoff. Two simple component trees with screenshot-comparison parity tests is more pragmatic than a shared abstraction layer that tries to serve both interactive editing and frame-by-frame rendering.

**Why compiled timeline over imperative state machine (M1 R1)?**
The compiled timeline is testable without Puppeteer, inspectable for debugging, and serializable. An imperative state machine that steps through frames couples timing logic to browser rendering, making it harder to test and reason about. All three models converged on this by Round 2.

**Why pre-mixed audio over FFmpeg adelay chains?**
500+ keystroke sounds × adelay filters = shell ARG_MAX explosion + opaque debugging. A PCM buffer where you write sound samples at exact byte offsets (frame × 2000 samples × 2 bytes × 2 channels) is simpler, debuggable, and bounded.

## Dissent Registry

- **M2**: Worker separation matters even for MVP. "Treating that separation as optional can produce a system that works in demos but fails the first time someone exports a long conversation." Valid concern — mitigated by hard timeout + semaphore, but M2 is right that this is technical debt.

- **M2**: Shared scene semantics (not just shared types) should exist as a formal contract between editor and export. The current plan relies on implicit parity validated by screenshot tests — this may be insufficient as styles grow.

- **M3**: The TimelineCompiler may become the most complex part of the system and a single point of failure. "The consensus is leaning towards a 'second system' design before the first system's basic performance characteristics have been validated." Valid — the POC must come first.

- **M2**: Animation tuning is a product risk, not just an implementation detail. "Technically correct exports can still feel wrong if timing curves and pauses are not tuned by style."

## Risks and Open Questions

### Must-Validate-Before-Committing (Week 0)
1. **Puppeteer screenshot latency on VPS** — if >150ms/frame, architecture needs rethinking. Build POC first.
2. **VPS memory** — Puppeteer (300MB) + FFmpeg (150MB) + Next.js (250MB). Minimum 4GB VPS recommended.
3. **Viewport → 1080p quality** — does 414px capture upscaled to 1080p look acceptable or blurry?

### Must-Decide-Before-Implementing
4. **Output aspect ratio** — portrait 1080x1920 (Stories format)? Unspecified in requirements.
5. **Render page data flow** — how Puppeteer target receives conversation JSON + images. Recommend: write temp JSON file, render page fetches by job ID.
6. **Font licensing** — SF Pro is not redistributable. Use Inter as iMessage substitute.

### Can-Decide-During-Implementation
7. **Progress feedback** — polling vs WebSockets for export status
8. **Hold-frame FFmpeg encoding** — concat demuxer duration metadata vs symlinks vs loop filter
9. **Draft persistence** — localStorage vs sessionStorage

## Protocol Notes
- Available models: M1, M2, M3
- Quality tier: max
- Rounds completed: 3
- Degraded mode: none
- Parse repairs used: yes (M2 R1 schema fix for OpenAI `const` → `type+enum`)
- M1=Claude, M2=Codex, M3=Gemini
