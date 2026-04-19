# TextStory Web V1 MVP -- Implementation Plan

## Architecture Overview

```
Next.js App (App Router, TypeScript, Tailwind)
├── /app                    # Pages
│   ├── page.tsx            # Editor (single page app for MVP)
│   ├── /render/page.tsx    # Hidden Puppeteer target (export rendering)
│   └── /api/export/        # Video export API routes
├── /components
│   ├── /editor/            # Interactive chat editor components
│   └── /export/            # Puppeteer-targeted render components
├── /lib
│   ├── timeline-compiler.ts    # THE core abstraction
│   ├── audio-premixer.ts       # PCM WAV builder
│   ├── video-pipeline.ts       # Puppeteer + FFmpeg orchestration
│   └── types.ts                # Shared types
├── /store                  # Zustand state
└── /public/sounds/         # Sound effect assets
```

Docker Compose (2 services):
```
nginx:80 → next:3000
```

---

## Implementation Phases

### Phase 0: Scaffolding + Puppeteer Benchmark (Day 1)

**Goal**: Project skeleton + validate that Puppeteer screenshot latency is viable on target hardware. This is the existential risk gate.

#### 0.1 Scaffold Next.js Project

```bash
# From texting_story_web/
npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias="@/*" --use-npm
```

**Files to create:**

| File | Purpose |
|------|---------|
| `package.json` | Add: puppeteer, fluent-ffmpeg, zustand, uuid |
| `app/page.tsx` | Placeholder "TextStory Web" |
| `app/render/page.tsx` | Minimal div with `id="capture-root"` |
| `app/api/export/route.ts` | Stub POST → 501 |
| `lib/types.ts` | Core TypeScript types (below) |
| `Dockerfile` | Node 22 + Chromium + FFmpeg |
| `docker-compose.yml` | nginx + next |
| `nginx/nginx.conf` | Reverse proxy config |
| `.env.example` | `PUPPETEER_EXECUTABLE_PATH`, `FFMPEG_PATH` |
| `tsconfig.json` | Strict mode, path aliases |

**Core types** (`lib/types.ts`):
```typescript
/** Who sent the message. */
type MessageSender = 'you' | 'friend';

/** A single chat message in the conversation. */
interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
}

/** Contact info for the chat partner. */
interface ChatContact {
  name: string;
  profileImageUrl?: string;  // Temporary upload URL or null
}

/** Which chat app style to render. */
type ChatStyle = 'imessage' | 'whatsapp' | 'instagram';

/** Full conversation state — editor produces this, export consumes it. */
interface Conversation {
  messages: ChatMessage[];
  contact: ChatContact;
  style: ChatStyle;
}

/** Output of TimelineCompiler — one entry per visual change. */
interface TimelineEntry {
  /** Unique visual state ID (for dedup). */
  id: string;
  /** What kind of visual change this represents. */
  type: 'empty' | 'breathing' | 'friend-typing' | 'friend-bubble'
      | 'you-typing' | 'you-bubble' | 'read-pause';
  /** Which message index this relates to (null for empty/breathing). */
  messageIndex: number | null;
  /** For you-typing: how many characters are visible. */
  charsVisible?: number;
  /** For friend-typing: animation progress 0-17 (18 frames). */
  typingFrame?: number;
  /** How many frames to HOLD this visual state (for pauses). */
  holdFrames: number;
  /** Audio events that fire when this entry starts rendering. */
  audioEvents: AudioEvent[];
  /** Messages visible in the chat at this point. */
  visibleMessages: ChatMessage[];
  /** Whether typing indicator is shown. */
  showTypingIndicator: boolean;
  /** Text in the composer bar (for you-typing states). */
  composerText: string | null;
}

/** A sound to play at a specific point in the timeline. */
interface AudioEvent {
  type: 'keystroke' | 'swoosh' | 'receive';
  /** Which sound variant (keystroke has 4 variants: 0-3). */
  soundIndex: number;
}

/** Export job status. */
type ExportStatus = 'queued' | 'compiling' | 'rendering' | 'encoding' | 'complete' | 'error';

interface ExportJob {
  id: string;
  status: ExportStatus;
  progress: number;       // 0-100
  error?: string;
  downloadUrl?: string;   // Set when status=complete
}
```

#### 0.2 Puppeteer Benchmark (CRITICAL)

**File**: `scripts/benchmark-puppeteer.ts`

This script runs BEFORE any product code is written. It answers:
1. How long does `page.screenshot()` take for a 414x896 viewport?
2. How does latency change after 50, 100, 200 screenshots?
3. Memory usage trend over 200 screenshots?

```typescript
// Benchmark script pseudocode:
// 1. Launch Puppeteer with --no-sandbox, viewport 414x896
// 2. Navigate to /render with a simple div containing styled text
// 3. Take 200 screenshots, measure each with performance.now()
// 4. Log: min, max, p50, p95, p99 latency
// 5. Log: RSS memory at frame 0, 50, 100, 150, 200
// 6. Calculate: estimated render time for 500-frame video
```

**Decision gate:**
- p95 < 100ms → Proceed as planned
- p95 100-200ms → Proceed but add progress estimation warnings
- p95 > 200ms → Reconsider (use Playwright, reduce resolution, or batch frames)

#### 0.3 Docker Setup

**`Dockerfile`**:
```dockerfile
FROM node:22-bookworm-slim

# Install Chromium and FFmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-inter \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

**`docker-compose.yml`**:
```yaml
services:
  web:
    build: .
    environment:
      - PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
      - NODE_ENV=production
    volumes:
      - tmp-data:/tmp/textstory
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - tmp-data:/tmp/textstory:ro
    depends_on:
      - web
    restart: unless-stopped

volumes:
  tmp-data:
```

**`nginx/nginx.conf`**:
```nginx
events { worker_connections 1024; }

http {
    client_max_body_size 5M;

    upstream nextjs {
        server web:3000;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://nextjs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_cache_bypass $http_upgrade;
        }

        # Serve exported videos directly from nginx
        location /exports/ {
            alias /tmp/textstory/exports/;
            add_header Content-Disposition 'attachment';
            expires 1h;
        }
    }
}
```

#### Tasks (Phase 0)
- [ ] `npx create-next-app` with options above
- [ ] Create `lib/types.ts` with all interfaces
- [ ] Create `Dockerfile` with Chromium + FFmpeg + fonts
- [ ] Create `docker-compose.yml` (nginx + web)
- [ ] Create `nginx/nginx.conf`
- [ ] Create `app/render/page.tsx` with minimal capture div
- [ ] Create `scripts/benchmark-puppeteer.ts`
- [ ] Run benchmark on dev machine
- [ ] Run benchmark inside Docker
- [ ] Document results in `docs/benchmark-results.md`

---

### Phase 1: Chat Editor UI (Days 2-4)

**Goal**: Fully functional chat editor with iMessage style. User can add messages, toggle sender, set contact name, upload profile photo. No export yet.

#### 1.1 Zustand Store

**File**: `store/chat-store.ts`

```typescript
interface ChatStore {
  // State
  messages: ChatMessage[];
  contact: ChatContact;
  style: ChatStyle;
  currentSender: MessageSender;
  
  // Actions
  addMessage: (text: string) => void;
  removeMessage: (id: string) => void;
  reorderMessages: (fromIndex: number, toIndex: number) => void;
  toggleSender: () => void;
  setContact: (contact: Partial<ChatContact>) => void;
  setStyle: (style: ChatStyle) => void;
  clearMessages: () => void;
}
```

Persist to `localStorage` via zustand/persist middleware so drafts survive page refresh.

#### 1.2 Editor Components

All in `components/editor/`:

| Component | File | Lines (est.) | Description |
|-----------|------|-------------|-------------|
| `ChatEditor` | `ChatEditor.tsx` | ~80 | Main container. Flexbox column: header + messages + composer |
| `ChatHeader` | `ChatHeader.tsx` | ~60 | Contact name, profile photo, back chevron. Click to edit. |
| `MessageList` | `MessageList.tsx` | ~50 | Scrollable message list. Auto-scrolls to bottom. |
| `MessageBubble` | `MessageBubble.tsx` | ~40 | Single bubble. Delegates to style-specific renderer. |
| `ComposerBar` | `ComposerBar.tsx` | ~70 | Text input + send button + sender toggle (You/Friend pill). |
| `ContactEditor` | `ContactEditor.tsx` | ~60 | Modal/dialog: edit name, upload profile photo. |
| `StylePicker` | `StylePicker.tsx` | ~40 | Three buttons: iMessage / WhatsApp / Instagram. |
| `ProfileUpload` | `ProfileUpload.tsx` | ~50 | File input + preview + EXIF correction. |
| `MessageActions` | `MessageActions.tsx` | ~30 | Delete/reorder controls per message (swipe or button). |

#### 1.3 Chat Style Delegates

Port the Flutter `ChatStyleUIDelegate` pattern. Each style provides React components for header, bubble, typing indicator, and composer appearance.

**Files**:
- `components/editor/styles/imessage.tsx` — Blue/gray bubbles, SF-like header, gray bg
- `components/editor/styles/whatsapp.tsx` — Green/white bubbles, green header, wallpaper bg
- `components/editor/styles/instagram.tsx` — Gradient/white bubbles, minimal header, profile pics next to incoming

**Interface** (in `lib/types.ts`):
```typescript
interface ChatStyleConfig {
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
  /** Render the full header bar. */
  renderHeader: (contact: ChatContact) => React.ReactNode;
  /** Render a message bubble. */
  renderBubble: (message: ChatMessage) => React.ReactNode;
  /** Render typing indicator with animation progress 0-1. */
  renderTypingIndicator: (progress: number) => React.ReactNode;
  /** Render the composer bar appearance (visual only, no input). */
  renderComposerBar: (typingText: string | null) => React.ReactNode;
}
```

**iMessage specifics** (from Flutter delegate):
- You bubble: `#007AFF`, white text, 18px border-radius
- Friend bubble: white, black text, subtle box-shadow
- Background: `#F2F2F7`
- Header: White bg, contact name centered, gray "chevron.left" + contact initial avatar
- Typing indicator: Gray bubble with 3 animated dots (opacity pulse)

#### 1.4 Profile Photo Upload

**API route**: `app/api/upload/route.ts`

```typescript
// POST /api/upload
// Content-Type: multipart/form-data
// Body: { file: File }
// Response: { url: string }  // e.g. "/uploads/abc123/photo.jpg"

// Steps:
// 1. Validate: image/jpeg or image/png, max 2MB
// 2. Generate session-based directory: /tmp/textstory/uploads/{uuid}/
// 3. EXIF correction: strip orientation metadata, rotate if needed
// 4. Resize to 200x200 (cover crop)
// 5. Save as JPEG quality 85
// 6. Return URL path
```

Use `sharp` for image processing (EXIF + resize in one pass).

#### 1.5 Editor Page Layout

**File**: `app/page.tsx`

```
┌─────────────────────────────────────────────┐
│  TextStory Web               [Style Picker]  │
├─────────────────────────────────────────────┤
│              ┌───────────────┐               │
│              │  Chat Preview │               │
│              │  (414px wide) │               │
│              │               │               │
│              │  Messages     │               │
│              │  ...          │               │
│              │               │               │
│              │  Composer     │               │
│              └───────────────┘               │
│                                              │
│  [Contact: Jane ▼]     [Export Video →]      │
├─────────────────────────────────────────────┤
│  Message list (editable):                    │
│  ┌─ You: Hey! ─────────── [×] [↑] [↓] ┐    │
│  ├─ Friend: What's up? ── [×] [↑] [↓] ┤    │
│  └─ You: nm just coding ─ [×] [↑] [↓] ┘    │
│                                              │
│  [You ↔ Friend]  [________________] [Send]   │
└─────────────────────────────────────────────┘
```

Two panels:
1. **Left/top**: Phone-shaped preview (414px wide, centered) showing the chat as it would appear
2. **Right/bottom**: Message list editor with add/remove/reorder + composer

On mobile: stack vertically. On desktop: side by side.

#### Tasks (Phase 1)
- [ ] Create `store/chat-store.ts` with Zustand + localStorage persist
- [ ] Create `components/editor/ChatEditor.tsx` (main container)
- [ ] Create `components/editor/ChatHeader.tsx`
- [ ] Create `components/editor/MessageList.tsx`
- [ ] Create `components/editor/MessageBubble.tsx`
- [ ] Create `components/editor/ComposerBar.tsx`
- [ ] Create `components/editor/ContactEditor.tsx` (modal)
- [ ] Create `components/editor/StylePicker.tsx`
- [ ] Create `components/editor/ProfileUpload.tsx`
- [ ] Create `components/editor/MessageActions.tsx`
- [ ] Create `components/editor/styles/imessage.tsx`
- [ ] Create `components/editor/styles/whatsapp.tsx` (stub — header + bubbles only)
- [ ] Create `components/editor/styles/instagram.tsx` (stub — header + bubbles only)
- [ ] Create `app/api/upload/route.ts` (profile photo)
- [ ] Create `app/page.tsx` (editor layout with preview + message list)
- [ ] Install and configure `sharp` for image processing
- [ ] Test: add messages, toggle sender, edit contact, upload photo
- [ ] Verify phone-shaped preview renders correctly at 414px width

---

### Phase 2: TimelineCompiler (Days 4-5)

**Goal**: Pure function that converts `Conversation` → `TimelineEntry[]`. This is the intellectual core. Zero browser dependencies. 100% unit testable.

**File**: `lib/timeline-compiler.ts`

#### 2.1 Timeline Constants

Ported directly from Flutter `chat_screen.dart`:

```typescript
/** Timeline compilation constants — ported from Flutter app. */
const TIMELINE = {
  FPS: 24,
  FRAME_DURATION_MS: 1000 / 24,  // ~41.67ms

  // Breathing gaps (pause between messages)
  BREATHING_GAP_MS: 1000,
  BREATHING_GAP_FRAMES: 24,  // 1000ms * 24fps / 1000

  // Friend typing indicator
  FRIEND_TYPING_FRAMES: 18,

  // You typing animation
  YOU_TYPING_MS_PER_CHAR: 300,
  YOU_TYPING_PAUSE_CHARS: ['.', '!', '?', ',', ' '],
  YOU_TYPING_PAUSE_EXTRA_FRAMES: 3,
  YOU_TYPING_FINAL_PAUSE_MS: 800,
  YOU_TYPING_FINAL_PAUSE_FRAMES: 19,  // 800ms * 24fps / 1000

  // Read pauses (time to "read" a message before responding)
  READ_PAUSE_BASE_MS: 500,
  READ_PAUSE_PER_CHAR_MS: 30,
  READ_PAUSE_MAX_ADDITIONAL_MS: 3000,

  // Inter-message delay (delay before starting next message)
  INTER_MSG_SAME_SENDER_MS: 1000,
  INTER_MSG_DIFF_SENDER_MS: 2000,
  INTER_MSG_PER_PREV_CHAR_MS: 20,
  INTER_MSG_MAX_CHAR_BONUS_MS: 2000,

  // Audio
  MIN_KEYSTROKE_SPACING_FRAMES: 1,  // ~42ms at 24fps
  KEYSTROKE_SWOOSH_BUFFER_FRAMES: 3,
  CAPTURE_LAG_SEC: 0.115,
} as const;
```

#### 2.2 Compiler Function

```typescript
/**
 * Compiles a conversation into a deterministic frame-by-frame timeline.
 *
 * This is a pure function: same input always produces same output.
 * No browser APIs, no side effects, fully unit-testable.
 *
 * @param conversation - The conversation to compile
 * @returns Array of timeline entries, each representing a visual state
 */
function compileTimeline(conversation: Conversation): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const { messages, contact } = conversation;

  // 1. Empty state (1 frame)
  entries.push({
    id: 'empty-0',
    type: 'empty',
    messageIndex: null,
    holdFrames: 1,
    audioEvents: [],
    visibleMessages: [],
    showTypingIndicator: false,
    composerText: null,
  });

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prevMsg = i > 0 ? messages[i - 1] : null;
    const visibleBefore = messages.slice(0, i);
    const visibleAfter = messages.slice(0, i + 1);

    // 2. Inter-message breathing gap (skip for first message)
    if (i > 0) {
      entries.push(makeBreathingEntry(i, visibleBefore));
    }

    if (msg.sender === 'friend') {
      // 3a. Friend typing indicator (18 frames)
      for (let frame = 0; frame < TIMELINE.FRIEND_TYPING_FRAMES; frame++) {
        entries.push({
          id: `friend-typing-${i}-${frame}`,
          type: 'friend-typing',
          messageIndex: i,
          typingFrame: frame,
          holdFrames: 1,
          audioEvents: [],
          visibleMessages: visibleBefore,
          showTypingIndicator: true,
          composerText: null,
        });
      }

      // 3b. Friend bubble appears (1 frame + hold for read pause)
      const readPauseFrames = calculateReadPauseFrames(msg.text);
      entries.push({
        id: `friend-bubble-${i}`,
        type: 'friend-bubble',
        messageIndex: i,
        holdFrames: readPauseFrames,
        audioEvents: [{ type: 'receive', soundIndex: 0 }],
        visibleMessages: visibleAfter,
        showTypingIndicator: false,
        composerText: null,
      });

    } else {
      // 4a. You typing — character by character
      const fullText = msg.text;
      const charEntries = buildYouTypingEntries(i, fullText, visibleBefore);
      entries.push(...charEntries);

      // 4b. Final pause before send
      entries.push({
        id: `you-typing-pause-${i}`,
        type: 'you-typing',
        messageIndex: i,
        charsVisible: fullText.length,
        holdFrames: TIMELINE.YOU_TYPING_FINAL_PAUSE_FRAMES,
        audioEvents: [],
        visibleMessages: visibleBefore,
        showTypingIndicator: false,
        composerText: fullText,
      });

      // 4c. You bubble appears
      const readPauseFrames = calculateReadPauseFrames(msg.text);
      entries.push({
        id: `you-bubble-${i}`,
        type: 'you-bubble',
        messageIndex: i,
        holdFrames: readPauseFrames,
        audioEvents: [{ type: 'swoosh', soundIndex: 0 }],
        visibleMessages: visibleAfter,
        showTypingIndicator: false,
        composerText: null,
      });
    }
  }

  return entries;
}
```

#### 2.3 Helper Functions

```typescript
/** Calculate read pause frames based on message length. */
function calculateReadPauseFrames(text: string): number {
  const ms = TIMELINE.READ_PAUSE_BASE_MS
    + Math.min(text.length * TIMELINE.READ_PAUSE_PER_CHAR_MS, TIMELINE.READ_PAUSE_MAX_ADDITIONAL_MS);
  return Math.round(ms * TIMELINE.FPS / 1000);
}

/** Build you-typing entries with keystroke audio events. */
function buildYouTypingEntries(
  messageIndex: number,
  fullText: string,
  visibleBefore: ChatMessage[],
): TimelineEntry[] {
  // Map each character to a frame, ensuring 1 char per frame minimum
  // Add extra hold frames at pause characters (.,!? etc)
  // Attach keystroke audio event to each new character frame
  // ...
}

/** Create a breathing gap entry. */
function makeBreathingEntry(afterIndex: number, visible: ChatMessage[]): TimelineEntry {
  return {
    id: `breathing-${afterIndex}`,
    type: 'breathing',
    messageIndex: null,
    holdFrames: TIMELINE.BREATHING_GAP_FRAMES,
    audioEvents: [],
    visibleMessages: visible,
    showTypingIndicator: false,
    composerText: null,
  };
}

/** Calculate total frame count from timeline. */
function totalFrames(timeline: TimelineEntry[]): number {
  return timeline.reduce((sum, entry) => sum + entry.holdFrames, 0);
}

/** Calculate video duration in seconds. */
function videoDuration(timeline: TimelineEntry[]): number {
  return totalFrames(timeline) / TIMELINE.FPS;
}
```

#### 2.4 Unit Tests

**File**: `lib/__tests__/timeline-compiler.test.ts`

Test cases:
1. Empty conversation → single "empty" entry
2. Single friend message → empty + friend-typing (18) + friend-bubble
3. Single you message → empty + you-typing (N chars) + pause + you-bubble
4. Two messages different senders → includes breathing gap between
5. Audio events: keystroke on each you-typing char, swoosh on you-bubble, receive on friend-bubble
6. Hold frames: read pause scales with message length
7. Deterministic: same input → same output (run twice, deep-equal)
8. Long message (100+ chars): verify frame count is reasonable
9. Verify `totalFrames()` and `videoDuration()` helpers

#### Tasks (Phase 2)
- [ ] Create `lib/timeline-compiler.ts` with constants + compiler
- [ ] Create `lib/__tests__/timeline-compiler.test.ts`
- [ ] Implement `compileTimeline()` main function
- [ ] Implement `buildYouTypingEntries()` with char-per-frame mapping
- [ ] Implement `calculateReadPauseFrames()`
- [ ] Write and pass all unit tests (minimum 9 cases above)
- [ ] Verify total frame counts match expected durations for sample conversations

---

### Phase 3: Export Render Components (Days 5-6)

**Goal**: Build the Puppeteer-targeted render page. These are separate from editor components — they share TypeScript types and Tailwind classes, but NOT React component code.

#### 3.1 Render Page

**File**: `app/render/page.tsx`

This is a `'use client'` page that:
1. Reads conversation data from `window.__TEXTSTORY_DATA__` (set by Puppeteer)
2. Renders the chat UI at a fixed 414x896 viewport
3. Exposes `window.__setFrame(entry: TimelineEntry)` for Puppeteer to call
4. Re-renders synchronously when frame state changes

```typescript
'use client';

/**
 * Puppeteer render target page.
 * Not meant for direct user access — used by the video export pipeline
 * to capture deterministic frames of the chat animation.
 */
export default function RenderPage() {
  const [frameState, setFrameState] = useState<TimelineEntry | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    // Expose frame control to Puppeteer
    (window as any).__setFrame = (entry: TimelineEntry) => {
      setFrameState(entry);
    };

    // Read conversation data injected by Puppeteer
    const data = (window as any).__TEXTSTORY_DATA__;
    if (data) setConversation(data);
  }, []);

  if (!conversation || !frameState) {
    return <div id="capture-root" style={{ width: 414, height: 896 }} />;
  }

  return (
    <div id="capture-root" style={{ width: 414, height: 896, overflow: 'hidden' }}>
      <ExportChatView
        conversation={conversation}
        frame={frameState}
      />
    </div>
  );
}
```

#### 3.2 Export Components

All in `components/export/`:

| Component | File | Description |
|-----------|------|-------------|
| `ExportChatView` | `ExportChatView.tsx` | Full chat layout: header + messages + composer. Reads from TimelineEntry. |
| `ExportHeader` | `ExportHeader.tsx` | Static header (no interactivity). Style-delegated. |
| `ExportMessageList` | `ExportMessageList.tsx` | Renders `frame.visibleMessages`. Auto-scrolled to bottom. |
| `ExportBubble` | `ExportBubble.tsx` | Static bubble. Style-delegated. |
| `ExportTypingIndicator` | `ExportTypingIndicator.tsx` | Dots at specific animation frame (not CSS-animated). |
| `ExportComposer` | `ExportComposer.tsx` | Shows `frame.composerText` or placeholder. |

Key differences from editor components:
- **No interactivity** — no click handlers, no inputs
- **No CSS animations** — typing indicator uses `frame.typingFrame` to calculate dot opacity
- **Fixed viewport** — always 414x896px
- **Deterministic** — same TimelineEntry always produces identical DOM

#### 3.3 Export Style Delegates

Same visual appearance as editor styles, but as static renderers.

**Files**:
- `components/export/styles/imessage-export.tsx`
- `components/export/styles/whatsapp-export.tsx`
- `components/export/styles/instagram-export.tsx`

These map the `ChatStyleConfig` values to static JSX. No state, no effects.

**Typing indicator rendering** (iMessage example):
```typescript
// Instead of CSS animation, use typingFrame to calculate dot state
function IMessageTypingIndicator({ typingFrame }: { typingFrame: number }) {
  // 18 frames total, 3 dots cycle through
  // Frame 0-5: dot 1 active, Frame 6-11: dot 2 active, Frame 12-17: dot 3 active
  const activeDot = Math.floor((typingFrame / 18) * 3);
  
  return (
    <div className="flex items-center gap-1 bg-gray-200 rounded-2xl px-3.5 py-3 ml-3 w-fit">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: i <= activeDot ? '#666' : '#ccc',
            opacity: i <= activeDot ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}
```

#### Tasks (Phase 3)
- [ ] Create `app/render/page.tsx` with `__setFrame` + `__TEXTSTORY_DATA__`
- [ ] Create `components/export/ExportChatView.tsx`
- [ ] Create `components/export/ExportHeader.tsx`
- [ ] Create `components/export/ExportMessageList.tsx`
- [ ] Create `components/export/ExportBubble.tsx`
- [ ] Create `components/export/ExportTypingIndicator.tsx`
- [ ] Create `components/export/ExportComposer.tsx`
- [ ] Create `components/export/styles/imessage-export.tsx`
- [ ] Create `components/export/styles/whatsapp-export.tsx` (stub)
- [ ] Create `components/export/styles/instagram-export.tsx` (stub)
- [ ] Verify: manually navigate to `/render`, inject data via console, confirm rendering

---

### Phase 4: Audio Pre-Mixer (Days 6-7)

**Goal**: Build the WAV pre-mixer that takes a compiled timeline and produces a single 48kHz stereo WAV file with all sounds at correct positions.

#### 4.1 Why Pre-Mix (Not FFmpeg Filters)

The Flutter app has 500+ keystroke sounds per video. Using FFmpeg `adelay` filters for each would:
- Hit shell ARG_MAX limits
- Create opaque filter graphs
- Be impossible to debug

Instead: write raw PCM samples to a buffer at exact byte offsets.

#### 4.2 Audio Pre-Mixer

**File**: `lib/audio-premixer.ts`

```typescript
/**
 * Pre-mixes all audio events from a compiled timeline into a single WAV file.
 *
 * Strategy: Create a raw PCM buffer (48kHz, 16-bit, stereo) sized to the
 * total video duration. For each audio event, read the source WAV/PCM,
 * calculate the byte offset from the event's frame number, and mix
 * (additive with clamping) into the buffer.
 *
 * This replaces the Flutter app's AVMutableComposition multi-track approach
 * and avoids FFmpeg's adelay filter explosion.
 */

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;  // 16-bit
const SAMPLES_PER_FRAME = SAMPLE_RATE / TIMELINE.FPS;  // 2000 at 24fps

interface SoundAsset {
  /** Raw PCM samples (Int16Array, interleaved stereo). */
  samples: Int16Array;
}

/**
 * Load sound assets from disk. Convert from WAV/M4A to raw PCM.
 * Called once at startup, cached in memory.
 */
async function loadSoundAssets(soundDir: string): Promise<{
  keystroke: SoundAsset;
  swoosh: SoundAsset;
  receive: SoundAsset;
}>;

/**
 * Mix all audio events into a single WAV buffer.
 *
 * @param timeline - Compiled timeline entries
 * @param assets - Pre-loaded sound assets
 * @returns Buffer containing a complete WAV file
 */
function mixAudio(timeline: TimelineEntry[], assets: SoundAssets): Buffer {
  const totalFrameCount = totalFrames(timeline);
  const totalSamples = totalFrameCount * SAMPLES_PER_FRAME * CHANNELS;
  const pcmBuffer = new Int16Array(totalSamples);  // Zero-initialized

  let currentFrame = 0;
  for (const entry of timeline) {
    for (const event of entry.audioEvents) {
      const asset = assets[event.type];
      const sampleOffset = currentFrame * SAMPLES_PER_FRAME * CHANNELS;

      // Additive mix with clamping to prevent clipping
      for (let i = 0; i < asset.samples.length && (sampleOffset + i) < totalSamples; i++) {
        const mixed = pcmBuffer[sampleOffset + i] + asset.samples[i];
        pcmBuffer[sampleOffset + i] = Math.max(-32768, Math.min(32767, mixed));
      }
    }
    currentFrame += entry.holdFrames;
  }

  return writeWavHeader(pcmBuffer);
}

/** Prepend a WAV file header to raw PCM data. */
function writeWavHeader(pcm: Int16Array): Buffer;
```

#### 4.3 Sound Asset Conversion

Sound files from the Flutter app:
- `sound1.wav` — keystroke (already WAV)
- `sound2.m4a` — swoosh (needs conversion)
- `sound3.m4a` — receive (needs conversion)

At Docker build time, convert all to 48kHz stereo WAV:
```bash
# In Dockerfile or a setup script
ffmpeg -i sound2.m4a -ar 48000 -ac 2 -f wav sound2.wav
ffmpeg -i sound3.m4a -ar 48000 -ac 2 -f wav sound3.wav
ffmpeg -i sound1.wav -ar 48000 -ac 2 -f wav sound1_48k.wav
```

Store converted WAVs in `/public/sounds/` as raw PCM for direct buffer reads.

#### Tasks (Phase 4)
- [ ] Copy sound assets from Flutter project to `public/sounds/`
- [ ] Create build script to convert all sounds to 48kHz stereo WAV
- [ ] Create `lib/audio-premixer.ts` with `loadSoundAssets()` + `mixAudio()`
- [ ] Implement `writeWavHeader()` for valid WAV file output
- [ ] Create `lib/__tests__/audio-premixer.test.ts`
- [ ] Test: compile a 3-message conversation, mix audio, verify WAV is valid
- [ ] Test: verify keystroke sounds are at correct sample offsets
- [ ] Test: verify no clipping on overlapping sounds

---

### Phase 5: Video Pipeline (Days 7-9)

**Goal**: End-to-end video export. Puppeteer captures frames, audio pre-mixer creates WAV, FFmpeg muxes into MP4.

#### 5.1 Video Pipeline Orchestrator

**File**: `lib/video-pipeline.ts`

```typescript
/**
 * Orchestrates the full video export pipeline:
 * 1. Compile timeline from conversation
 * 2. Launch Puppeteer, navigate to /render
 * 3. For each unique visual state: set frame → screenshot → save PNG
 * 4. Pre-mix audio into single WAV
 * 5. Generate FFmpeg concat file (frame path + duration)
 * 6. FFmpeg: concat demuxer → H.264 video + WAV audio → MP4
 * 7. Cleanup temp files
 */

import { Semaphore } from './semaphore';

/** Global semaphore: only 1 export at a time. */
const exportSemaphore = new Semaphore(1);

interface PipelineOptions {
  conversation: Conversation;
  jobId: string;
  onProgress: (status: ExportStatus, progress: number) => void;
}

async function runExportPipeline(options: PipelineOptions): Promise<string> {
  const acquired = await exportSemaphore.acquire(/* timeout */ 5000);
  if (!acquired) throw new Error('Export queue full. Try again later.');

  try {
    const { conversation, jobId, onProgress } = options;
    const workDir = `/tmp/textstory/jobs/${jobId}`;
    await fs.mkdir(workDir, { recursive: true });

    // Step 1: Compile timeline
    onProgress('compiling', 5);
    const timeline = compileTimeline(conversation);
    const frameCount = totalFrames(timeline);
    const duration = videoDuration(timeline);

    // Step 2: Capture frames with Puppeteer
    onProgress('rendering', 10);
    const framePaths = await captureFrames(timeline, conversation, workDir, (pct) => {
      onProgress('rendering', 10 + pct * 0.6);  // 10-70% of progress
    });

    // Step 3: Pre-mix audio
    onProgress('encoding', 72);
    const audioPath = path.join(workDir, 'audio.wav');
    const assets = await loadSoundAssets(SOUND_DIR);
    const wavBuffer = mixAudio(timeline, assets);
    await fs.writeFile(audioPath, wavBuffer);

    // Step 4: Generate concat file
    onProgress('encoding', 75);
    const concatPath = await generateConcatFile(timeline, framePaths, workDir);

    // Step 5: FFmpeg mux
    onProgress('encoding', 78);
    const outputPath = `/tmp/textstory/exports/${jobId}.mp4`;
    await ffmpegMux(concatPath, audioPath, outputPath, (pct) => {
      onProgress('encoding', 78 + pct * 0.2);  // 78-98%
    });

    // Step 6: Cleanup
    await fs.rm(workDir, { recursive: true, force: true });
    onProgress('complete', 100);

    return `/exports/${jobId}.mp4`;
  } finally {
    exportSemaphore.release();
  }
}
```

#### 5.2 Frame Capture

**Function in** `lib/video-pipeline.ts`:

```typescript
/**
 * Captures unique visual frames using Puppeteer.
 *
 * Key optimization: Only take a screenshot when the visual state CHANGES.
 * Hold frames (breathing, read pause) reuse the same PNG via the concat
 * demuxer's duration metadata — no duplicate screenshots needed.
 */
async function captureFrames(
  timeline: TimelineEntry[],
  conversation: Conversation,
  workDir: string,
  onProgress: (pct: number) => void,
): Promise<Map<string, string>> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });

  // Navigate to render page and inject conversation data
  await page.evaluateOnNewDocument((data) => {
    (window as any).__TEXTSTORY_DATA__ = data;
  }, conversation);
  await page.goto(`http://localhost:3000/render`, { waitUntil: 'networkidle0' });

  // Deduplicate: only screenshot when visual state actually changes
  const framePaths = new Map<string, string>();  // entry.id → file path
  let screenshotIndex = 0;

  // Group consecutive entries with same visual state
  const uniqueEntries = deduplicateVisualStates(timeline);

  for (let i = 0; i < uniqueEntries.length; i++) {
    const entry = uniqueEntries[i];

    // Set the frame state via Puppeteer
    await page.evaluate((e) => {
      (window as any).__setFrame(e);
    }, entry);

    // Wait for React to re-render
    await page.waitForFunction(() => {
      return document.querySelector('#capture-root')?.children.length > 0;
    });

    // Small delay for font rendering + layout stabilization
    await page.evaluate(() => new Promise(r => setTimeout(r, 50)));

    // Screenshot
    const filePath = path.join(workDir, `frame_${String(screenshotIndex).padStart(4, '0')}.png`);
    await page.screenshot({
      path: filePath,
      clip: { x: 0, y: 0, width: 414, height: 896 },
      type: 'png',
    });

    framePaths.set(entry.id, filePath);
    screenshotIndex++;
    onProgress(i / uniqueEntries.length);
  }

  await browser.close();
  return framePaths;
}
```

#### 5.3 FFmpeg Concat Demuxer

**Key insight**: The concat demuxer lets us specify duration per frame. A breathing gap is one PNG held for 1 second, NOT 24 duplicate PNGs. This dramatically reduces both disk I/O and screenshot count.

```typescript
/**
 * Generates an FFmpeg concat demuxer file.
 *
 * Format:
 *   file 'frame_0000.png'
 *   duration 0.0417
 *   file 'frame_0001.png'
 *   duration 0.75
 *   ...
 */
async function generateConcatFile(
  timeline: TimelineEntry[],
  framePaths: Map<string, string>,
  workDir: string,
): Promise<string> {
  const lines: string[] = [];

  for (const entry of timeline) {
    const framePath = framePaths.get(entry.id);
    if (!framePath) continue;

    const duration = (entry.holdFrames / TIMELINE.FPS).toFixed(6);
    lines.push(`file '${framePath}'`);
    lines.push(`duration ${duration}`);
  }

  // FFmpeg concat demuxer requires last file repeated without duration
  const lastPath = framePaths.get(timeline[timeline.length - 1].id);
  if (lastPath) {
    lines.push(`file '${lastPath}'`);
  }

  const concatPath = path.join(workDir, 'concat.txt');
  await fs.writeFile(concatPath, lines.join('\n'));
  return concatPath;
}
```

#### 5.4 FFmpeg Mux Command

```typescript
/**
 * Mux video frames + audio into final MP4.
 *
 * Uses concat demuxer for variable-duration frames (avoids duplicate PNGs).
 * Pads the 414x896 capture to 1080x1920 with a styled background.
 */
async function ffmpegMux(
  concatFile: string,
  audioFile: string,
  outputPath: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'concat', '-safe', '0', '-i', concatFile,  // Video frames
      '-i', audioFile,                                    // Audio
      '-vf', 'pad=1080:1920:(1080-iw)/2:(1920-ih)/2:color=black',  // Center in 1080x1920
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-c:a', 'aac', '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-shortest',
      '-y', outputPath,
    ];

    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      // Parse progress from FFmpeg stderr (time= pattern)
      const match = data.toString().match(/time=(\d+):(\d+):(\d+)/);
      if (match) {
        // Calculate progress percentage from time
      }
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });

    // Hard timeout
    setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('FFmpeg timed out after 120s'));
    }, 120_000);
  });
}
```

#### 5.5 Concurrency Semaphore

**File**: `lib/semaphore.ts`

```typescript
/**
 * Simple async semaphore for limiting concurrent video exports.
 * V1: concurrency=1 (one export at a time).
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(timeoutMs = 5000): Promise<boolean> {
    if (this.permits > 0) {
      this.permits--;
      return true;
    }
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      this.waiting.push(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}
```

#### Tasks (Phase 5)
- [ ] Create `lib/semaphore.ts`
- [ ] Create `lib/video-pipeline.ts` with `runExportPipeline()`
- [ ] Implement `captureFrames()` with Puppeteer
- [ ] Implement `deduplicateVisualStates()` for screenshot optimization
- [ ] Implement `generateConcatFile()` for FFmpeg concat demuxer
- [ ] Implement `ffmpegMux()` with timeout + progress parsing
- [ ] Test: export a 3-message conversation end-to-end
- [ ] Verify: output MP4 plays correctly in browser
- [ ] Verify: audio is synced with visual events
- [ ] Measure: total export time for 5-message, 10-message conversations

---

### Phase 6: API Route + Frontend Export Flow (Days 9-10)

**Goal**: Wire up the export button in the editor to trigger server-side video generation with progress polling.

#### 6.1 Export API Route

**File**: `app/api/export/route.ts`

```typescript
/**
 * POST /api/export
 * Body: { conversation: Conversation }
 * Response: { jobId: string }
 *
 * Starts an async video export job. Poll /api/export/[jobId] for status.
 */
export async function POST(req: NextRequest) {
  const { conversation } = await req.json();

  // Validate conversation
  if (!conversation?.messages?.length) {
    return NextResponse.json({ error: 'No messages' }, { status: 400 });
  }
  if (conversation.messages.length > 50) {
    return NextResponse.json({ error: 'Max 50 messages for V1' }, { status: 400 });
  }

  const jobId = crypto.randomUUID();

  // Store initial job status
  jobStore.set(jobId, { id: jobId, status: 'queued', progress: 0 });

  // Fire and forget — the pipeline updates job status as it progresses
  runExportPipeline({
    conversation,
    jobId,
    onProgress: (status, progress) => {
      jobStore.set(jobId, { id: jobId, status, progress });
    },
  }).then((downloadUrl) => {
    jobStore.set(jobId, { id: jobId, status: 'complete', progress: 100, downloadUrl });
  }).catch((error) => {
    jobStore.set(jobId, { id: jobId, status: 'error', progress: 0, error: error.message });
  });

  return NextResponse.json({ jobId });
}
```

**File**: `app/api/export/[jobId]/route.ts`

```typescript
/**
 * GET /api/export/[jobId]
 * Response: ExportJob
 *
 * Returns current status of an export job.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const job = jobStore.get(params.jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  return NextResponse.json(job);
}
```

**File**: `lib/job-store.ts`

```typescript
/**
 * In-memory job store. For V1, this is fine since concurrency=1
 * and jobs are ephemeral. V2 will use Redis.
 *
 * Auto-expires completed jobs after 1 hour.
 */
const jobs = new Map<string, ExportJob>();

export const jobStore = {
  get: (id: string) => jobs.get(id),
  set: (id: string, job: ExportJob) => {
    jobs.set(id, job);
    if (job.status === 'complete' || job.status === 'error') {
      setTimeout(() => jobs.delete(id), 60 * 60 * 1000);
    }
  },
};
```

#### 6.2 Frontend Export Flow

**File**: `components/editor/ExportButton.tsx`

```typescript
/**
 * Export button with progress overlay.
 *
 * States: idle → submitting → polling → downloading → done/error
 */
export function ExportButton() {
  const conversation = useChatStore((s) => ({
    messages: s.messages,
    contact: s.contact,
    style: s.style,
  }));

  const [state, setState] = useState<'idle' | 'exporting' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  async function handleExport() {
    setState('exporting');
    setProgress(0);

    // 1. Submit export request
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation }),
    });
    const { jobId } = await res.json();

    // 2. Poll for status
    const pollInterval = setInterval(async () => {
      const statusRes = await fetch(`/api/export/${jobId}`);
      const job: ExportJob = await statusRes.json();

      setProgress(job.progress);
      setStatusText(formatStatus(job.status));

      if (job.status === 'complete') {
        clearInterval(pollInterval);
        setState('idle');
        // Trigger download
        window.location.href = job.downloadUrl!;
      } else if (job.status === 'error') {
        clearInterval(pollInterval);
        setState('error');
      }
    }, 1000);
  }

  // Render: button + full-screen progress overlay when exporting
}
```

#### 6.3 Export Progress Overlay

Matches the Flutter app's export overlay:
- Full-screen dark overlay (bg-black/85)
- Circular progress indicator
- "Generating Video" title
- "X% Complete" subtitle
- Linear progress bar
- "Processing message N of M" or "Finalizing video..."
- Cancel button (top-right)

#### Tasks (Phase 6)
- [ ] Create `lib/job-store.ts`
- [ ] Create `app/api/export/route.ts` (POST)
- [ ] Create `app/api/export/[jobId]/route.ts` (GET)
- [ ] Create `components/editor/ExportButton.tsx`
- [ ] Create `components/editor/ExportOverlay.tsx` (progress UI)
- [ ] Wire ExportButton into the editor page
- [ ] Test: full export flow from editor → API → pipeline → download
- [ ] Test: progress updates display correctly
- [ ] Test: error handling (empty conversation, timeout)
- [ ] Test: concurrent export rejection (semaphore)

---

### Phase 7: Polish + Deployment (Days 10-12)

**Goal**: Visual polish, edge cases, VPS deployment.

#### 7.1 Visual Polish
- [ ] Phone frame border around the chat preview (rounded corners, notch)
- [ ] Responsive layout: stack on mobile, side-by-side on desktop
- [ ] Dark background behind the phone preview
- [ ] Smooth animations in the editor (not export) — bubble pop-in, scroll
- [ ] Loading states for profile upload, export initiation
- [ ] Error toast messages (not just console.log)

#### 7.2 Edge Cases
- [ ] Empty message validation (don't add blank messages)
- [ ] Very long messages (> 500 chars): warn user, cap at reasonable length
- [ ] Conversation with only 1 message: still export correctly
- [ ] Special characters in messages (emoji, newlines, Unicode)
- [ ] Profile photo with extreme aspect ratio (EXIF rotation)
- [ ] Network disconnect during export polling: retry with backoff
- [ ] FFmpeg timeout: surface clear error to user

#### 7.3 Temp File Cleanup
- [ ] Cron job or `setInterval` to clean `/tmp/textstory/uploads/` older than 24h
- [ ] Clean `/tmp/textstory/exports/` older than 1h
- [ ] Clean `/tmp/textstory/jobs/` older than 2h

```typescript
// In app startup or a separate worker
setInterval(async () => {
  await cleanupOldFiles('/tmp/textstory/uploads', 24 * 60 * 60 * 1000);
  await cleanupOldFiles('/tmp/textstory/exports', 60 * 60 * 1000);
  await cleanupOldFiles('/tmp/textstory/jobs', 2 * 60 * 60 * 1000);
}, 30 * 60 * 1000);  // Run every 30 minutes
```

#### 7.4 VPS Deployment
- [ ] Push Docker image to registry (or build on VPS)
- [ ] `docker compose up -d` on VPS
- [ ] Verify Nginx serves the app on port 80
- [ ] Verify export pipeline works on VPS (Puppeteer + FFmpeg)
- [ ] Set up domain + SSL (Certbot or Cloudflare tunnel)
- [ ] Test memory usage: Puppeteer + FFmpeg + Next.js concurrently
- [ ] Set Docker memory limits (recommend 4GB minimum for the `web` service)

#### Tasks (Phase 7)
- [ ] All visual polish items above
- [ ] All edge case items above
- [ ] Implement temp file cleanup
- [ ] Deploy to VPS
- [ ] Verify end-to-end on VPS
- [ ] SSL setup
- [ ] Memory/performance monitoring

---

## File Inventory (Complete)

### Core Application
| Path | Purpose | Phase |
|------|---------|-------|
| `app/page.tsx` | Editor page (single page app) | 1 |
| `app/render/page.tsx` | Puppeteer render target | 3 |
| `app/api/export/route.ts` | POST: start export | 6 |
| `app/api/export/[jobId]/route.ts` | GET: poll status | 6 |
| `app/api/upload/route.ts` | POST: profile photo | 1 |
| `app/layout.tsx` | Root layout | 0 |
| `app/globals.css` | Tailwind + font imports | 0 |

### Editor Components
| Path | Purpose | Phase |
|------|---------|-------|
| `components/editor/ChatEditor.tsx` | Main editor container | 1 |
| `components/editor/ChatHeader.tsx` | Contact name + avatar | 1 |
| `components/editor/MessageList.tsx` | Scrollable message list | 1 |
| `components/editor/MessageBubble.tsx` | Single message bubble | 1 |
| `components/editor/ComposerBar.tsx` | Text input + send + sender toggle | 1 |
| `components/editor/ContactEditor.tsx` | Edit contact modal | 1 |
| `components/editor/StylePicker.tsx` | iMessage/WhatsApp/Instagram buttons | 1 |
| `components/editor/ProfileUpload.tsx` | Photo upload + preview | 1 |
| `components/editor/MessageActions.tsx` | Delete/reorder per message | 1 |
| `components/editor/ExportButton.tsx` | Trigger export | 6 |
| `components/editor/ExportOverlay.tsx` | Full-screen progress | 6 |
| `components/editor/styles/imessage.tsx` | iMessage style config | 1 |
| `components/editor/styles/whatsapp.tsx` | WhatsApp style config | 1 |
| `components/editor/styles/instagram.tsx` | Instagram style config | 1 |

### Export Components
| Path | Purpose | Phase |
|------|---------|-------|
| `components/export/ExportChatView.tsx` | Full render layout | 3 |
| `components/export/ExportHeader.tsx` | Static header | 3 |
| `components/export/ExportMessageList.tsx` | Static message list | 3 |
| `components/export/ExportBubble.tsx` | Static bubble | 3 |
| `components/export/ExportTypingIndicator.tsx` | Frame-based dots | 3 |
| `components/export/ExportComposer.tsx` | Static composer | 3 |
| `components/export/styles/imessage-export.tsx` | iMessage export style | 3 |
| `components/export/styles/whatsapp-export.tsx` | WhatsApp export style | 3 |
| `components/export/styles/instagram-export.tsx` | Instagram export style | 3 |

### Core Library
| Path | Purpose | Phase |
|------|---------|-------|
| `lib/types.ts` | All TypeScript interfaces | 0 |
| `lib/timeline-compiler.ts` | Conversation → timeline | 2 |
| `lib/audio-premixer.ts` | Timeline → WAV | 4 |
| `lib/video-pipeline.ts` | Full export orchestration | 5 |
| `lib/semaphore.ts` | Concurrency limiter | 5 |
| `lib/job-store.ts` | In-memory job tracking | 6 |
| `lib/__tests__/timeline-compiler.test.ts` | Timeline unit tests | 2 |
| `lib/__tests__/audio-premixer.test.ts` | Audio mixer tests | 4 |

### Store
| Path | Purpose | Phase |
|------|---------|-------|
| `store/chat-store.ts` | Zustand conversation state | 1 |

### Infrastructure
| Path | Purpose | Phase |
|------|---------|-------|
| `Dockerfile` | Node + Chromium + FFmpeg + fonts | 0 |
| `docker-compose.yml` | nginx + web | 0 |
| `nginx/nginx.conf` | Reverse proxy + static exports | 0 |
| `.env.example` | Environment variables | 0 |
| `scripts/benchmark-puppeteer.ts` | Perf benchmark | 0 |

### Assets
| Path | Purpose | Phase |
|------|---------|-------|
| `public/sounds/keystroke.wav` | Keystroke sound (48kHz) | 4 |
| `public/sounds/swoosh.wav` | Send sound (48kHz) | 4 |
| `public/sounds/receive.wav` | Receive sound (48kHz) | 4 |

---

## Critical Path

```
Phase 0 (Day 1)        Phase 1 (Days 2-4)        Phase 2 (Days 4-5)
Scaffold + Benchmark ──→ Chat Editor UI ──────────→ TimelineCompiler
        │                                                   │
        │                 Phase 3 (Days 5-6)                │
        └────────────────→ Export Render Components ←────────┘
                                    │
                          Phase 4 (Days 6-7)
                          Audio Pre-Mixer
                                    │
                          Phase 5 (Days 7-9)
                          Video Pipeline
                                    │
                          Phase 6 (Days 9-10)
                          API + Frontend Export
                                    │
                          Phase 7 (Days 10-12)
                          Polish + Deploy
```

Phases 1 and 3 can partially overlap (editor and export components share types but not code).
Phase 2 (TimelineCompiler) blocks Phases 4 and 5.
Phase 0 benchmark is the existential risk gate — if p95 > 200ms, stop and reconsider.

---

## V2 Migration Notes

Design decisions that make V2 refactoring clean:

1. **TimelineCompiler is a pure function** — extract to a shared package when splitting to worker service
2. **Audio pre-mixer has no browser deps** — moves to worker unchanged
3. **Job store interface** — swap `Map` for Redis by implementing the same `get/set` interface
4. **Semaphore** — replace with BullMQ when adding a job queue
5. **Export components** are already isolated in `/components/export/` — worker needs only these + `/render` page
6. **`child_process.spawn`** for FFmpeg — same API whether in Next.js API route or standalone worker
7. **Conversation JSON** is the contract boundary — worker receives JSON, returns MP4 URL

What V2 adds:
- Separate Docker service for video worker
- BullMQ + Redis job queue
- Multiple concurrent exports
- Image messages
- AI conversation generation
- More chat styles
