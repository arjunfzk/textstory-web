# TextStory Web

Create fake text conversations and export them as MP4 videos with realistic typing animations, sound effects, and professional timing — built for TikTok and Reels creators.

## What It Does

TextStory Web turns scripted dialogue into cinematic texting story videos. Type your conversation, pick a chat style, and export a pixel-perfect video with:

- **Character-by-character typing** with keystroke sounds
- **Proportional friend typing indicators** (bouncing dots that scale with message length)
- **Send/receive sound effects** (swoosh, notification)
- **Image messages** with realistic pre-appear delays
- **3 chat styles**: iMessage, WhatsApp, Instagram — authentic headers, bubbles, and composers

Timing is tuned for short-form video pacing using a sublinear sqrt curve for friend typing duration, snappy breathing gaps, and fast character reveal — so exported videos feel natural at TikTok/Reels speed.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind v4) |
| State | Zustand with localStorage persistence |
| Video Pipeline | Puppeteer (frame capture) + FFmpeg (encoding) |
| Audio | Custom PCM buffer mixer at 48kHz/16-bit/stereo |
| Image Processing | Sharp (EXIF correction, resize) |
| Validation | Zod schemas |
| Testing | Vitest (30 tests) |
| Deployment | Docker Compose (Nginx + Next.js with Chromium + FFmpeg) |

## Architecture

```
Editor UI ──► Zustand Store ──► TimelineCompiler (pure fn)
                                       │
                              ┌────────┼────────┐
                              ▼        ▼        ▼
                         AudioPreMixer  │  ExportComponents
                              │        │        │
                              ▼        ▼        ▼
                           WAV file  Puppeteer  Frames
                              │     screenshots   │
                              └────────┬──────────┘
                                       ▼
                                 FFmpeg concat
                                       │
                                       ▼
                                    MP4 video
```

**Key design decisions:**
- `lib/` never imports from `components/`, `store/`, or `app/` — clean dependency boundary
- Two separate component trees: `/components/editor/` (interactive, Tailwind) and `/components/export/` (static, inline styles for Puppeteer determinism)
- Export components use plain `<img>` (not `next/image`) for headless browser compatibility
- TimelineCompiler is a pure function — same input always produces same output, fully unit-testable
- Frame acknowledgement uses double-rAF with frame ID correlation to prevent screenshot race conditions

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

Open http://localhost:3000 for the landing page, http://localhost:3000/editor for the editor.

### Video Export (requires system dependencies)

Export requires Chromium and FFmpeg installed on the system:

```bash
# macOS
brew install chromium ffmpeg

# Set Puppeteer to use system Chromium
export PUPPETEER_EXECUTABLE_PATH=$(which chromium)
```

## Deployment

### Docker (recommended)

The Docker image bundles Chromium, FFmpeg, and required fonts:

```bash
# Build and start
docker compose up -d

# Check health
docker compose ps
```

Services:
- **web**: Next.js app with Chromium + FFmpeg (port 3000 internal)
- **nginx**: Reverse proxy (port 80), serves export files from shared volume

### VPS Deployment

```bash
# Clone and build
git clone https://github.com/arjunfzk/textstory-web.git
cd textstory-web
docker compose up -d --build

# SSL with Certbot (after DNS is pointing)
# Add SSL nginx config to nginx/nginx.conf
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUPPETEER_EXECUTABLE_PATH` | Path to Chromium binary | `/usr/bin/chromium` (Docker) |
| `NODE_ENV` | Environment | `development` |

## Project Structure

```
app/
  page.tsx                    # Marketing landing page
  editor/                     # Editor route
  render/                     # Puppeteer render target (not user-facing)
  api/
    export/                   # POST to start export, GET to poll status
    upload/                   # Profile photo upload + serving
    upload-image/             # Message image upload (aspect-ratio preserved)

components/
  editor/                     # Interactive editor components (Tailwind)
    ChatEditor.tsx            # 3-column Obsidian Gold layout
    PhonePreview.tsx          # 414x896 iPhone preview
    MessageBubble.tsx         # Text + image bubbles
  export/                     # Static export components (inline styles)
    ExportChatView.tsx        # Frame-controlled chat view
    ExportBubble.tsx          # Deterministic bubbles for Puppeteer
    ExportTypingIndicator.tsx # Frame-based bouncing dots
    ExportComposer.tsx        # Composer with typing text
  marketing/                  # Landing page components

lib/
  types.ts                    # All TypeScript types (zero deps)
  timeline-compiler.ts        # Pure fn: Conversation → TimelineEntry[]
  audio-premixer.ts           # PCM buffer mixer for sound effects
  video-pipeline.ts           # Puppeteer + FFmpeg orchestrator
  style-tokens.ts             # iMessage/WhatsApp/Instagram visual tokens
  semaphore.ts                # Async FIFO semaphore (concurrency=1)
  job-store.ts                # In-memory job tracking with TTL

store/
  chat-store.ts               # Zustand store with localStorage persist
```

## Timeline Compiler

The core of the video pipeline. Converts a conversation into a deterministic frame-by-frame timeline:

```
"Hi"     → 18 frames friend typing (0.7s) + bubble appear + read pause
"Hello!" → 3 frames/char typing + punctuation pause + send pause + swoosh
[image]  → 8 frame delay + bubble appear (no typing animation)
```

**Timing constants** (tuned for TikTok/Reels):
- Friend typing: sqrt curve `clamp(650 + 140*sqrt(chars) + 8*chars, 700, 2600)ms`
- You typing: 125ms/char, +83ms at punctuation
- Breathing gap: 500ms between messages
- Image pre-appear: 333ms (friend), 250ms (you)
- Dot cycle: 750ms (3 dots, 18 frames)

## Design System

**Obsidian Gold** — dark theme with warm gold accents:
- Base: `#131313`
- Gold accent: `#ffd13d`
- Headlines: Plus Jakarta Sans
- Body: Inter
- No-border philosophy — depth through color and shadow

## License

MIT
