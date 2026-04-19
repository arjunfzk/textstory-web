# Multi-Model Brainstorm Report: V1 Implementation Details

## Recommended Implementation Stack

After 3 rounds of debate, here are the converged recommendations across all models.

---

### 1. EXACT LIBRARIES & VERSIONS

| Package | Version | Why |
|---------|---------|-----|
| `next` | `^15.3.0` | Latest stable App Router |
| `react` / `react-dom` | `^19.1.0` | React 19 stable, Server Components |
| `typescript` | `^5.8.0` | Strict mode |
| `tailwindcss` | `^4.1.0` | v4 CSS-first config |
| `zustand` | `^5.0.3` | With `persist` middleware for localStorage drafts |
| `react-hook-form` | `^7.55.0` | ContactEditor form ONLY (not composer/message list) |
| `zod` | `^3.24.0` | Validation for forms + API input |
| `puppeteer` | `^24.0.0` | Export frame capture (NOT Playwright) |
| `@playwright/test` | `^1.50.0` | E2E + visual regression tests ONLY |
| `sharp` | `^0.34.0` | EXIF correction + resize (not Jimp) |
| `pino` | `^9.6.0` | Structured JSON logging |
| `vitest` | `^3.1.0` | Unit + component testing (per CLAUDE.md) |
| `@testing-library/react` | `^16.3.0` | Component tests |
| `happy-dom` | `^16.0.0` | Vitest environment (10x faster than jsdom) |
| `simple-git-hooks` | `^2.11.0` | Pre-commit hooks (lighter than husky) |
| `nano-staged` | `^0.8.0` | Lint staged files |
| `prettier` | `^3.5.0` | Code formatting |
| `eslint` | `^9.20.0` | With eslint-config-next |

**NOT using:**
- `fluent-ffmpeg` — direct `child_process.spawn` is simpler for our 2 FFmpeg commands
- Any WAV library — custom 20-line PCM writer (WAV is a trivial format)
- `uuid` — `crypto.randomUUID()` is built-in
- `husky` / `lint-staged` — `simple-git-hooks` + `nano-staged` is lighter
- `next/image` in export components — breaks Puppeteer with lazy loading. Plain `<img>` in export, `next/image` in editor.

---

### 2. UI/UX LAYOUT

**Desktop (>768px):** Two-column split
```
┌──────────────────────────────────────────────────────┐
│  TextStory Web                                        │
├──────────────────┬───────────────────────────────────┤
│                  │                                    │
│  Style Picker    │     ┌─────────────────────┐       │
│  [iMsg][WA][IG]  │     │   ╭─────────────╮   │       │
│                  │     │   │  Phone Frame │   │       │
│  Messages:       │     │   │             │   │       │
│  ┌─ You: Hey ─┐  │     │   │  Chat UI    │   │       │
│  ├─ Her: Hi! ─┤  │     │   │  Preview    │   │       │
│  └─ You: sup ─┘  │     │   │             │   │       │
│  [↑][↓][×]       │     │   ╰─────────────╯   │       │
│                  │     └─────────────────────┘       │
│  Contact: [Jane] │        (sticky, never scrolls)    │
│                  │                                    │
│  [You ⇄ Friend]  │                                    │
│  [___________][→] │                                    │
│                  │     [▶ Export Video]               │
└──────────────────┴───────────────────────────────────┘
     40%                        60%
```

**Mobile (<768px):** Stacked
- Phone preview on top (scaled via CSS `transform: scale()` to fit)
- Editor section below (scrollable)
- Min supported width: 320px

**Phone Frame:** 414x896px (iPhone 14/15). Wrapped in bezel div with rounded corners + notch. CSS `transform: scale()` + container query for responsive sizing.

**Style Picker:** Three horizontal cards with mini-preview. Selected = blue ring border.

**Message Interactions:** Click to select → action bar (delete, move up, move down). No drag-reorder, no swipe-delete.

**Composer:** Text input + Send button. Sender toggle is a pill switch `[You | Friend]` above input.

**Export Overlay:** Full-screen modal (bg-black/90). Centered card: circular progress ring, percentage, status text, cancel button.

---

### 3. CODE ARCHITECTURE

**Module Boundaries (import rules):**
```
lib/          → NEVER imports from components/ or app/ or store/
store/        → imports from lib/types only
components/   → imports from lib/ and store/
app/          → imports from everything
```
This ensures `lib/` extracts cleanly to a worker in V2.

**Style Delegates:**
```typescript
// lib/style-tokens.ts — pure data, no React
interface StyleTokens {
  name: string;
  headerBg: string;
  chatBg: string;
  youBubbleBg: string;
  youBubbleText: string;
  friendBubbleBg: string;
  friendBubbleText: string;
  bubbleRadius: number;
  fontFamily: string;
  fontSize: number;
  avatarSize: number;
  showAvatarOnBubble: boolean;
}

const IMESSAGE_TOKENS: StyleTokens = { ... };
const WHATSAPP_TOKENS: StyleTokens = { ... };
const INSTAGRAM_TOKENS: StyleTokens = { ... };

const STYLE_TOKENS: Record<ChatStyle, StyleTokens> = { ... };
```

Render components consume tokens — they don't contain them. Both editor and export components read the same tokens object.

**Server vs Client Components:**
- Server: `layout.tsx`, metadata exports
- Client: everything in `/components/` (all interactive), `/app/render/page.tsx` (Puppeteer target)

**Error Boundaries:**
- One wrapping entire editor
- One wrapping ExportOverlay
- None on /render page (Puppeteer catches navigation errors)

**ExportManifest (V2-ready):**
```typescript
// Written to disk per job — worker reads this in V2
interface ExportManifest {
  jobId: string;
  conversation: Conversation;
  style: ChatStyle;
  assets: { contactPhoto?: string }; // paths to normalized files in workspace
  createdAt: string;
}
```

---

### 4. RACE CONDITIONS & EDGE CASES

| Scenario | Mitigation |
|----------|------------|
| Edit during export | Freeze editor UI (overlay). Export runs on snapshot copy taken at submit time. |
| Rapid export clicks | Disable button on click. Server semaphore rejects with 429 + toast message. |
| Tab close during export | `beforeunload` warning. Job continues server-side. TTL cleanup handles orphans. |
| Puppeteer DOM sync | React sets `window.__FRAME_RENDERED__ = true` in useEffect. Puppeteer waits for this flag, 5s timeout per frame. |
| File cleanup vs active job | Cleanup checks mtime. Never delete files < 1 hour old. Active jobs have fresh mtimes. |
| Concurrent Puppeteer launches | Semaphore(1) prevents concurrent browser instances. Acquire timeout = 5s → 429 if busy. |
| OOM during render | child_process has memory limit. Puppeteer browser closed between jobs. 120s hard timeout with SIGKILL. |

---

### 5. TESTING STRATEGY

| Layer | Tool | What to Test |
|-------|------|-------------|
| **TimelineCompiler** | Vitest | Pure function: 0 msgs, 1 friend, 1 you, alternating 10, 50 msgs, emoji, empty, 500-char. Determinism (same input → same output). Frame count verification. |
| **AudioPreMixer** | Vitest | Known events → verify WAV header, sample count, byte offsets. Peak amplitude check (no clipping). |
| **Editor Components** | Vitest + RTL + happy-dom | Add message, toggle sender, style picker, contact editor. NO visual snapshots (too brittle). |
| **Export Components** | Playwright Test | Visual regression: screenshot /render with known data, compare golden files. Catches font/layout drift. |
| **Video Pipeline** | Vitest (mocked) | Mock child_process.spawn for FFmpeg. Mock Puppeteer Browser/Page. Test orchestration logic. |
| **E2E** | Playwright Test | Full flow: load editor → add 3 messages → export → verify MP4 exists. Runs in Docker. |
| **Puppeteer Benchmark** | Custom script | 200 screenshots, measure p50/p95/p99 latency. Memory trend. Run on VPS. |

**Mock Strategy:** Never call real Puppeteer/FFmpeg in unit tests. Integration tests (CI only) use real tools inside Docker.

---

### 6. CODE QUALITY

**Documentation:** JSDoc (not TSDoc) per CLAUDE.md. Top-level docstring on every file. Doc comments on non-obvious functions. Inline comments explain WHY, not WHAT.

**Error Handling:** try/catch at API route boundaries. Pipeline functions return `{ success, data?, error? }` pattern for recoverable errors. Throw only for unrecoverable (OOM, disk full). Never swallow errors.

**Logging:** pino with structured JSON. Log fields: `job_id`, `status`, `duration_ms`, `frame_count`, `file_size_bytes`, `screenshot_latency_p50`. No console.log in production.

**ESLint:** `eslint-config-next` + `@typescript-eslint/strict`. No-any (error), no-unused-vars (error), consistent-type-imports (warn).

**Formatting:** Prettier (single config, run via nano-staged on pre-commit).

**Import Order:** (1) Node builtins → (2) External packages → (3) `@/*` aliases → (4) Relative. Enforced by eslint-plugin-import.

---

### 7. FONT STRATEGY (elevated from "detail" to "critical")

All 3 models flagged this as the #1 source of visual bugs:

1. **iMessage:** Inter (closest match to SF Pro, legally redistributable)
2. **WhatsApp:** Roboto (Google Fonts, matches Android WhatsApp)
3. **Instagram:** System UI stack (matches Instagram's approach)
4. **Emoji:** Noto Color Emoji (consistent across platforms)

**Loading:**
- Editor: `next/font/google` for Inter and Roboto
- Export/Render page: CSS `@font-face` pointing to same font files
- Docker: `apt-get install fonts-inter fonts-noto-color-emoji` + download Roboto

**Verification:** Playwright visual regression test comparing editor screenshot vs /render screenshot with same data. Must match within threshold.

---

### 8. SOUND ASSET PIPELINE

- Source files: `keystroke.wav`, `swoosh.m4a`, `receive.m4a` (from Flutter app)
- **Build step** (Dockerfile): `ffmpeg -i sound.m4a -ar 48000 -ac 2 -f wav sound.wav`
- All sounds pre-converted to 48kHz stereo WAV at build time
- Loaded into memory at server startup (`Buffer.from(fs.readFileSync(...))`)
- AudioPreMixer writes samples at exact byte offsets into PCM buffer

---

## Dissent Registry

- **M2:** Wants `puppeteer-core` (not full `puppeteer`) to avoid bundled Chromium download — use system Chromium from apt instead. Valid optimization for Docker image size.
- **M3:** Suggested `wavefile` library instead of custom WAV writer. Rejected by M1/M2 — the custom writer is 20 lines and avoids a dependency for trivial functionality.
- **M2:** Wants explicit `ExportManifest` interface as a first-class type, not just "write JSON to disk." Valid — promotes it from implementation detail to contract.
- **M3:** Suggested three-column layout on wide screens. Rejected — two columns is simpler and the style picker doesn't need its own column.

## Protocol Notes
- Available models: M1, M2, M3
- Quality tier: max
- Rounds completed: 3
- Degraded mode: none
- Parse repairs: M3 R3 JSON parse failed (used raw text extraction)
- M1=Claude, M2=Codex, M3=Gemini
