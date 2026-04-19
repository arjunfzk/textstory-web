# TextStory Web — Project Context

## What This Is

A web app that creates fake text conversations (iMessage/WhatsApp/Instagram) and exports them as MP4 videos with typing animations, sound effects, and professional timing. Built for TikTok/Reels creators. Port of a Flutter iOS app.

## Tech Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- Zustand for state (localStorage persist with versioned migrations)
- Puppeteer for server-side frame capture + FFmpeg for encoding
- Sharp for image processing (EXIF strip + resize)
- Zod for API validation
- Vitest for testing (30 tests)
- Docker Compose for deployment (Nginx + Next.js with Chromium + FFmpeg)

## Architecture

Two component trees with strict separation:
- `/components/editor/` — interactive, uses Tailwind, client components
- `/components/export/` — static, inline styles only, plain `<img>`, for Puppeteer determinism

Module boundary: `lib/` never imports from `components/`, `store/`, or `app/`.

### Core Pipeline

```
Conversation → TimelineCompiler (pure fn) → TimelineEntry[]
                                               │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                         AudioPreMixer    Puppeteer         ExportComponents
                         (PCM buffer)    (screenshots)     (inline styles)
                              │                │                │
                              └────────────────┼────────────────┘
                                               ▼
                                          FFmpeg concat
                                               ▼
                                            MP4 video
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/types.ts` | All TypeScript types. ChatMessage is a discriminated union (TextMessage \| ImageMessage) |
| `lib/timeline-compiler.ts` | Pure function: Conversation → TimelineEntry[]. Sqrt-curve friend typing. |
| `lib/audio-premixer.ts` | PCM buffer mixer at 48kHz/16-bit/stereo |
| `lib/video-pipeline.ts` | Puppeteer + FFmpeg orchestrator with async semaphore |
| `store/chat-store.ts` | Zustand store with localStorage persist (version 2) |
| `app/render/page.tsx` | Puppeteer render target — NOT user-facing |
| `app/api/export/route.ts` | Export POST with Zod discriminated union validation |
| `app/api/upload-image/route.ts` | Message image upload (aspect-ratio preserved, returns dimensions) |

## Design System

**Obsidian Gold** — dark theme for creator tools:
- Base: `#131313`, Container: `#1c1b1b`, Elevated: `#2a2a2a`
- Gold accent: `#ffd13d`, gradient to `#e2b500`
- Text: `#e5e2e1` primary, `#d2c5ad` secondary
- Ghost border: `#4e4634`
- Headlines: Plus Jakarta Sans (`var(--font-jakarta)`)
- Body: Inter (`var(--font-inter)`)
- "No-Line Rule" — no 1px borders, use background color shifts

Reference mockups in `stitch_premium_texting_studio 2/` (gitignored).

## Timing Constants (TikTok/Reels optimized)

Friend typing uses a sublinear sqrt curve:
```
clamp(650 + 140*sqrt(chars) + 8*chars, 700, 2600) ms
```

| Constant | Value | Duration |
|----------|-------|----------|
| Breathing gap | 12 frames | 0.5s |
| You typing | 3 frames/char | 125ms/char |
| Punctuation extra | +2 frames | +83ms |
| Send pause | 11 frames | 0.46s |
| Read pause | 350-1950ms | varies by text length |
| Dot cycle | 18 frames | 0.75s per cycle |
| Image read pause | 30 frames | 1.25s |
| Friend image delay | 8 frames | 333ms |
| You image delay | 6 frames | 250ms |

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing page |
| `/editor` | Chat editor (3-column layout) |
| `/render` | Puppeteer render target (hidden) |
| `/api/export` | POST to start export, returns jobId |
| `/api/export/[jobId]` | GET to poll export status |
| `/api/upload` | POST profile photo (200x200 square crop) |
| `/api/upload-image` | POST message image (aspect-ratio preserved) |
| `/api/upload/[sessionId]/[filename]` | GET to serve uploaded images (dev mode) |
| `/exports/[filename]` | GET to serve exported MP4s (dev mode) |

## Testing

30 tests across 2 files:
- `lib/__tests__/timeline-compiler.test.ts` — 21 tests (text, image, emoji, timing, determinism)
- `lib/__tests__/audio-premixer.test.ts` — 9 tests (WAV validity, mixing, clamping)

Run: `npm test`

## Security Decisions

- `imageUrl` and `profileImageUrl` restricted to `/api/upload/` prefix in Zod schema (SSRF prevention)
- Message text capped at 2000 chars in export schema
- Upload serving route validates sessionId as UUID regex
- Filename allowlist on all file-serving routes
- No auth/rate-limiting yet (Phase 7 work)
