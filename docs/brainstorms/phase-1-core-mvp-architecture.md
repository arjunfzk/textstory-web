# Brainstorm: Phase 1 Core MVP -- Rendering Engine, Animation System, Video Export Pipeline

## Problem Statement

Build the core product of TextStory Web: a chat conversation editor that renders pixel-perfect iMessage/WhatsApp/Instagram bubbles, animates typing indicators and character-by-character text appearance, and exports the result as an MP4 video with synchronized sound effects (keystroke per character, swoosh on send, notification on receive). Deploy on a VPS with Docker Compose + Nginx.

No auth, no payments, no AI, no SEO -- just the core creation and export flow.

---

## Prior Art Research

### Replit's Video Rendering Engine (2025)

Replit built a deterministic video renderer by **virtualizing time itself**. Key insights:

- **Time virtualization**: Replace `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date.now()`, `performance.now()` with a fake clock. Each frame advances time by exactly `1000/fps` ms. A 500ms render still produces smooth 60fps video.
- **Audio capture**: Monkey-patch Web Audio API and HTMLMediaElement. Intercept audio file fetches, `decodeAudioData`, `AudioNode` connection graphs, playback timing. Server-side FFmpeg mixes tracks with proper timing.
- **Frame loop**: Sync CSS animations -> sync video elements -> tick virtual clock -> fire callbacks -> capture screenshot -> repeat.
- **Tech stack**: TypeScript, Puppeteer, FFmpeg, mp4box.js, libav.js.
- **Key lesson**: Single-flight rendering (concurrency=1) to prevent frame corruption from memory pressure.

### Remotion (React Video Framework)

- Renders React components frame-by-frame into MP4.
- Server-side rendering via Node.js APIs, AWS Lambda, or self-hosted Docker.
- Lambda is fastest (distributed rendering) but costs ~$0.01-0.02/video.
- Self-hosted Docker: `node:22-bookworm-slim` base, needs Chrome dependencies. ~8% slower than bare metal.
- **License**: Free for individuals/small companies. Company license required for larger orgs (~$25/dev/month, $100/month minimum).
- **Limitation**: Adds a framework dependency. Your rendering logic must be expressed as Remotion compositions.

### Timecut/Timesnap (Deterministic Frame Capture)

- Node.js program: overwrites JS time functions, captures frames with Puppeteer, pipes to FFmpeg.
- **Critical limitation**: Only overwrites JavaScript functions. CSS transitions/animations bypass the system entirely.
- Two modes: cache frames to disk (default) or pipe directly to FFmpeg.
- Lightweight but limited -- no audio handling, no video element support.

### WebCodecs API (Browser-Native Encoding)

- Hardware-accelerated H.264/H.265 encoding in the browser.
- Safari: VideoDecoder only (as of early 2026). AudioDecoder in Safari Technology Preview.
- Chrome/Edge/Firefox: Full support.
- **Not viable for MVP** due to Safari gap and audio limitations.

### FFmpeg.wasm (Browser-Side FFmpeg)

- ~25MB WASM download. Production-ready but slow on low-end devices.
- Can merge video + audio, but complex audio mixing (multiple overlapping sounds at precise timestamps) is painful.
- No iOS Safari support for SharedArrayBuffer (required for multi-threaded mode).

---

## The Six Technical Questions

### 1. RENDERING ENGINE: How to render pixel-perfect chat bubbles?

**Recommendation: DOM-based rendering (React components), NOT Canvas.**

Rationale from the Flutter app analysis:
- The Flutter app uses native widgets (rounded containers, text styles, shadows) for each style delegate. These map directly to CSS/HTML.
- iMessage: Blue `#007AFF` bubbles with 18px border-radius, white text, subtle box-shadow.
- WhatsApp: Green `#DCF8C6` outgoing, white incoming, distinctive "tails", green header `#075E54`.
- Instagram: Purple-to-pink gradient outgoing, white with thin border incoming, circular profile pictures next to incoming messages.

DOM gives you:
- Pixel-perfect text rendering (Canvas text rendering differs from DOM -- fonts, line-height, kerning).
- CSS gradients (Instagram), box-shadows, border-radius -- all trivially correct.
- Profile images via `<img>` with `border-radius: 50%` (the Flutter app uses `FileImage` with circular clips).
- Responsive layout without manual coordinate math.

**Architecture**: Port the Flutter `ChatStyleUIDelegate` pattern directly to React:

```
interface ChatStyleDelegate {
  renderHeader(contact: ChatContact): ReactNode;
  renderMessageBubble(message: ChatMessage, isExporting: boolean): ReactNode;
  renderTypingIndicator(animationProgress: number): ReactNode;
  renderComposer(typingText?: string): ReactNode;
  renderExportView(messages: ChatMessage[], ...): ReactNode;
}
```

Each style (iMessage, WhatsApp, Instagram) implements this interface as a React component set. This is a 1:1 port of the Strategy pattern from the Flutter codebase.

**Profile images**: The Flutter app supports optional `imagePath` on `ChatContact`. On web, users upload an image, we store it as a blob URL (or base64 data URL) in client state. During export, the image is already rendered in the DOM. No special handling needed for the rendering engine -- it is just an `<img>` tag.

---

### 2. ANIMATION SYSTEM: How to animate typing, character appearance, bubble slide-in?

**Recommendation: JavaScript-driven state changes, NOT CSS animations.**

This is critical. The Flutter app uses `setState()` to drive all animations frame-by-frame during export. The web equivalent must work the same way because:

1. **CSS animations are non-deterministic for frame capture.** Timecut's biggest limitation is that CSS animations bypass its time virtualization. Remotion explicitly controls frame timing through React state.
2. **Character-by-character typing requires state-driven rendering.** The Flutter app calculates `charsToDraw` per frame using a custom easing function, then sets `_composerTypingText = fullText.substring(0, charsToDraw)`. This is pure state manipulation.
3. **Sound sync depends on knowing exactly which frame shows which state.** The Flutter app tracks `_soundEvents` with exact frame numbers. CSS animations would make this impossible.

**Animation state machine** (ported from Flutter `_exportChat`):

```typescript
type ExportPhase =
  | { type: 'empty' }                          // Initial empty chat
  | { type: 'breathing', afterMessage: number } // Pause between messages
  | { type: 'friend-typing', messageIndex: number, frame: number }
  | { type: 'friend-bubble', messageIndex: number }
  | { type: 'you-typing', messageIndex: number, charIndex: number, frame: number }
  | { type: 'you-bubble', messageIndex: number }
  | { type: 'read-pause', messageIndex: number };
```

For **live preview** (not export), use CSS animations freely -- they look great in real-time. The key insight is that the preview animation system and the export animation system are separate. Preview uses `requestAnimationFrame` + CSS transitions. Export uses a deterministic frame-by-frame state machine.

**Typing animation parameters** (from Flutter app):
- ~300ms per character (slowed down from 150ms)
- Natural pause points: after `.`, `!`, `?`, `,`, ` `
- Three-phase easing: slow start (0-30%), medium (30-80%), slow end (80-100%)
- 800ms final pause before sending
- Minimum frames = charCount + (pauseCount * 3)

**Breathing gaps** (from Flutter app):
- 1000ms pause between bubbles = 24 frames at 24fps
- Duplicate the current frame during pauses (same as Flutter `_addBreathingGap`)

---

### 3. VIDEO EXPORT PIPELINE: Client-side vs Server-side?

**Recommendation: Server-side only for MVP. Puppeteer + FFmpeg on VPS.**

Why NOT client-side for MVP:
- FFmpeg.wasm is 25MB, no iOS Safari SharedArrayBuffer support.
- MediaRecorder produces WebM only, no MP4.
- WebCodecs has no Safari AudioDecoder.
- Audio sync with multiple overlapping keystroke sounds at exact frame positions is extremely hard client-side.
- The Flutter app already does frame-by-frame capture + native FFmpeg compositing. The server-side approach is the direct equivalent.

**Recommended server-side pipeline** (inspired by Replit's approach + Flutter app's architecture):

```
Step 1: Client sends conversation JSON to server
  {
    messages: [{text, sender, timestamp}],
    contact: {name, profileImageUrl},
    style: "imessage" | "whatsapp" | "instagram",
    settings: {fps: 24, resolution: "1080x1920"}
  }

Step 2: Server renders the SAME React components in headless Chrome
  - Puppeteer opens a special /render endpoint
  - The render page receives the conversation data
  - JavaScript animation state machine advances frame-by-frame
  - Virtual time control (a la Replit/timecut) ensures deterministic capture

Step 3: Frame-by-frame capture
  - For each animation state, update React state, wait for render, screenshot
  - Track sound events with exact frame numbers (same as Flutter _soundEvents)
  - Save frames as PNGs (same as Flutter frame_000.png, frame_001.png...)

Step 4: FFmpeg composites video + audio
  - Encode PNGs to H.264 video at 24fps
  - Mix sound effects at precise timestamps using the sound event list
  - Output MP4

Step 5: Return MP4 URL to client for download
```

**Why this mirrors the Flutter app perfectly:**
- Flutter: `RepaintBoundary.toImage()` -> PNG frames -> native AVAssetWriter -> AVMutableComposition (audio)
- Web: Puppeteer `page.screenshot()` -> PNG frames -> FFmpeg (video) -> FFmpeg (audio mixing)

The sound timing system from the Flutter app (`_soundEvents` list with `{frame, type, snd}`) maps directly to FFmpeg audio overlay commands.

---

### 4. IMAGE HANDLING: Profile photos and image messages

**For MVP (profile photos only, no image messages):**

```
Upload flow:
1. User selects image via <input type="file" accept="image/*">
2. Client resizes to 200x200px using canvas (save bandwidth)
3. Upload to server as multipart/form-data
4. Server saves to /tmp/uploads/{sessionId}/{filename}
5. Serve via Nginx static file serving from upload directory
6. URL passed in conversation JSON for export
7. Cleanup: cron job deletes files older than 24 hours
```

**Why temporary storage is fine for MVP:**
- No auth means no persistent user data anyway.
- Profile photos only need to survive the export session.
- VPS disk is cheap. A 200x200 JPEG is ~10KB.

**During export:**
- The profile image URL is already in the DOM (rendered by the React chat component).
- Puppeteer captures it naturally in the screenshot -- no special handling needed.
- This is identical to how Flutter handles `FileImage` in the header and Instagram message bubbles.

**Image messages (Phase 2+):**
- Same upload flow but allow larger images (up to 1MB).
- Render as image bubbles within the chat (like iMessage photo messages).
- These render in DOM just like text bubbles -- Puppeteer captures them automatically.

---

### 5. DO WE NEED FastAPI? Or can this be purely Next.js?

**Recommendation: YES, use FastAPI for the video worker. Next.js for the frontend + lightweight API routes.**

| Concern | Next.js API Routes | FastAPI |
|---------|-------------------|---------|
| Video rendering (Puppeteer + FFmpeg) | Blocks Node.js event loop. Long-running (10-60s). Crashes serverless. | Async + subprocess. Natural fit for heavy compute. |
| Job queue / progress tracking | Would need Bull/BullMQ + Redis anyway | Celery + Redis OR just asyncio tasks for MVP |
| FFmpeg subprocess management | Possible but awkward in Node.js | Native subprocess, better error handling |
| File I/O (frames, temp videos) | Works but Node.js streams are painful | Python file ops are simpler |
| Future AI features | Need Python anyway for LLM calls | Already there |
| Deployment | Already have Docker pattern from meme_factory_web | Same pattern |

**However, for MVP simplicity, consider this hybrid:**

```
Next.js handles:
  - Frontend (React chat editor, preview)
  - API routes for simple CRUD (save/load conversations)
  - Image upload endpoint (saves to shared volume)

FastAPI handles:
  - POST /api/export -- accepts conversation JSON, returns job ID
  - GET /api/export/{jobId}/status -- polling for progress
  - GET /api/export/{jobId}/download -- returns MP4 file

Communication:
  - Next.js frontend calls FastAPI directly (or via Nginx proxy)
  - No message queue needed for MVP -- FastAPI handles one export at a time
  - For MVP concurrency: simple asyncio.Semaphore(2) to limit parallel exports
```

**Docker Compose architecture** (extending your meme_factory_web pattern):

```yaml
services:
  web:          # Next.js frontend + simple API
  api:          # FastAPI video worker
  puppeteer:    # Headless Chrome (or bundled in api container)
  nginx:        # Reverse proxy
```

Actually, for MVP simplicity, bundle Puppeteer inside the FastAPI container. One less service to manage.

---

### 6. SOUND DESIGN: Audio in web video export

**Recommendation: FFmpeg audio mixing on the server. Same architecture as Flutter's AVMutableComposition.**

The Flutter app uses three sound types:
- `type: 0` -- Keystroke (0.wav) -- plays per character typed
- `type: 1` -- Swoosh (message_sent.m4a) -- plays when "You" message appears
- `type: 2` -- Receive (message_received.m4a) -- plays when "Friend" message appears

**FFmpeg audio overlay approach:**

```bash
# Step 1: Create silent video from frames
ffmpeg -framerate 24 -i frame_%03d.png -c:v libx264 -pix_fmt yuv420p silent.mp4

# Step 2: Create audio mix from sound events
# For each sound event, create an FFmpeg filter chain:
ffmpeg -i silent.mp4 \
  -i keystroke.wav -i keystroke.wav -i swoosh.m4a -i receive.m4a \
  -filter_complex "
    [1]adelay=1200|1200[k1];
    [2]adelay=1400|1400[k2];
    [3]adelay=5000|5000[sw1];
    [4]adelay=7500|7500[rc1];
    [k1][k2][sw1][rc1]amix=inputs=4:duration=longest
  " \
  -c:v copy -c:a aac output.mp4
```

**In practice, use Python's subprocess to build the FFmpeg command dynamically:**

```python
def build_ffmpeg_command(
    silent_video: str,
    sound_events: list[SoundEvent],
    output_path: str,
    fps: float = 24.0,
) -> list[str]:
    """Build FFmpeg command to mix audio with video."""
    inputs = ["-i", silent_video]
    filter_parts = []

    for i, event in enumerate(sound_events):
        sound_file = SOUND_FILES[event.type]
        inputs.extend(["-i", sound_file])
        delay_ms = int((event.frame / fps) * 1000)
        filter_parts.append(f"[{i+1}]adelay={delay_ms}|{delay_ms}[a{i}]")

    mix_inputs = "".join(f"[a{i}]" for i in range(len(sound_events)))
    filter_parts.append(
        f"{mix_inputs}amix=inputs={len(sound_events)}:duration=longest"
    )

    return [
        "ffmpeg", *inputs,
        "-filter_complex", ";".join(filter_parts),
        "-c:v", "copy", "-c:a", "aac",
        "-shortest", output_path,
    ]
```

**Key timing details from Flutter app:**
- Frame repeat map: Different frames display for different durations. A message bubble frame repeats `30 + (text.length * 4)` times.
- Cumulative time calculation: Sound placement accounts for all frame repeats. `frameStartTime = sum(repeats[0..frame]) / fps`.
- Keystroke filtering: Skip keystrokes within 3 frames of a swoosh/receive sound. Minimum spacing of ~40ms between keystrokes.
- Capture lag compensation: `kCaptureLagSec = 0.115` -- sounds are shifted back 115ms to account for visual capture delay.

**For MVP, simplify the frame repeat system:**
Instead of the Flutter app's frame duplication approach, use FFmpeg's variable frame rate or `concat` demuxer with explicit durations. This avoids generating hundreds of duplicate PNGs.

```python
# Generate a concat file with per-frame durations
# frame_000.png duration 0.0417  (1/24s base)
# frame_001.png duration 2.5     (message display: 30 + len*4 frames / 24fps)
# frame_002.png duration 1.0     (breathing gap)
```

This is cleaner than the Flutter approach of literally duplicating PNG files.

---

## Decision Matrix

| Question | Recommendation | Effort | Risk | Rationale |
|----------|---------------|--------|------|-----------|
| Rendering | DOM/React components | Low | Low | Direct port of Flutter delegates to React+CSS |
| Animation | JS state machine (export), CSS (preview) | Medium | Low | Deterministic frame control, same as Flutter |
| Video export | Server-side Puppeteer + FFmpeg | Medium | Low | Proven pattern (Replit, vsub.io), same as Flutter's native pipeline |
| Images | Temp upload to VPS disk, serve via Nginx | Low | Low | Simple, no cloud storage needed for MVP |
| Backend | FastAPI for export worker, Next.js for frontend | Medium | Low | Separation of concerns, Python FFmpeg ecosystem |
| Audio | FFmpeg server-side mixing with adelay filters | Medium | Medium | Direct equivalent of Flutter's AVMutableComposition |

---

## Recommended Architecture

```
                    User Browser
                         |
                    [Nginx :80]
                    /         \
              /app/*        /api/export/*
                |                |
          [Next.js :3000]  [FastAPI :8000]
          - Chat editor     - Export endpoint
          - Preview          - Puppeteer + Chrome
          - Image upload     - Frame capture
          - Static assets    - FFmpeg compositing
                             - Temp file management
                                  |
                         [Shared Volume]
                         /uploads (images)
                         /exports (temp videos)
```

### Container Architecture

```yaml
services:
  web:
    build: ./frontend
    # Next.js app with chat editor
    
  api:
    build: ./backend
    # FastAPI + Puppeteer (headless Chrome) + FFmpeg
    # Single container for simplicity
    volumes:
      - uploads:/app/uploads
      - exports:/app/exports
    
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - uploads:/var/www/uploads:ro  # Serve uploaded images
      - exports:/var/www/exports:ro  # Serve exported videos
```

### Export Flow (Detailed)

```
1. User creates conversation in chat editor (Next.js)
2. User clicks "Export Video"
3. Frontend sends POST /api/export with conversation JSON
4. FastAPI:
   a. Generates unique job ID
   b. Returns {jobId, status: "processing"} immediately
   c. Starts async export task:
      i.   Launch Puppeteer, navigate to /render?data={encoded_json}
      ii.  The /render page is a special Next.js page that:
           - Receives conversation data via query params or postMessage
           - Renders the chat using the SAME React components as the editor
           - Exposes a window.__advanceFrame() function
      iii. For each frame:
           - Call page.evaluate('window.__advanceFrame()')
           - page.screenshot({type: 'png'})
           - Track sound events
      iv.  Run FFmpeg: frames -> silent video -> add audio -> MP4
      v.   Save MP4 to /exports/{jobId}.mp4
      vi.  Update job status to "complete"
5. Frontend polls GET /api/export/{jobId}/status
6. When complete, frontend shows download link: /exports/{jobId}.mp4
```

### Key Shared Code

The React chat components are used in TWO contexts:
1. **Editor mode**: Interactive, with input fields, buttons, CSS animations.
2. **Export/Render mode**: Non-interactive, controlled by the animation state machine, captured by Puppeteer.

This is the same pattern as the Flutter app where `buildExportView()` is separate from the interactive `build()` method.

---

## MVP Scope (What to Build)

### In Scope
- Chat editor: add messages, toggle sender (You/Friend), set contact name
- Profile photo upload (optional, default avatar if none)
- Three chat styles: iMessage, WhatsApp, Instagram
- Real-time preview with typing animations (CSS-driven, approximate)
- Server-side video export at 24fps with sound effects
- MP4 download
- VPS deployment with Docker Compose + Nginx
- Watermark on free exports (same as Flutter app)

### Out of Scope (Phase 2+)
- User auth / accounts
- Payments / premium tier
- AI conversation generation
- SEO landing pages
- Image messages (only profile photos in MVP)
- Client-side export fallback
- Group chat (3+ participants)
- Custom sound effects
- Template gallery

### Estimated Effort
- **Chat editor + style delegates**: 3-4 days (port from Flutter, mostly CSS work)
- **Animation state machine**: 2-3 days (port timing logic from Flutter)
- **Server-side export pipeline**: 3-4 days (Puppeteer + FFmpeg integration)
- **Audio mixing**: 1-2 days (FFmpeg filter chains)
- **Image upload**: 0.5 day
- **Docker + Nginx deployment**: 1 day (reuse meme_factory_web pattern)
- **Testing + polish**: 2-3 days

**Total: ~2-3 weeks**

---

## Next Steps

1. Scaffold Next.js project with Tailwind + TypeScript + Zustand
2. Port iMessage style delegate from Flutter to React component
3. Build the chat editor (message list, composer, sender toggle, contact editing)
4. Build the animation state machine for export
5. Set up FastAPI + Puppeteer + FFmpeg in Docker
6. Implement the export pipeline (frame capture -> video -> audio mixing)
7. Wire up the frontend export flow (progress polling, download)
8. Deploy to VPS with Docker Compose + Nginx
9. Test with real conversations, tune timing parameters

---

## Sources

- [Replit: We Built a Video Rendering Engine by Lying to the Browser About What Time It Is](https://blog.replit.com/browsers-dont-want-to-be-cameras)
- [Remotion: Make videos programmatically with React](https://www.remotion.dev/)
- [Remotion Server-Side Rendering](https://www.remotion.dev/docs/ssr)
- [Remotion SSR Options Comparison](https://www.remotion.dev/docs/compare-ssr)
- [Remotion Docker Guide](https://www.remotion.dev/docs/docker)
- [Remotion License & Pricing](https://www.remotion.dev/docs/license)
- [Timecut: Deterministic web animation capture](https://github.com/tungs/timecut)
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [WebCodecs API Browser Support](https://caniuse.com/webcodecs)
- [WebCodecs API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [Puppeteer Screen Recorder](https://www.npmjs.com/package/puppeteer-screen-recorder)
- [html2canvas](https://html2canvas.hertzen.com/)
- [FastAPI + Next.js Full-Stack Architecture](https://dev.to/alexmayhew-dev/fastapi-nextjs-15-the-full-stack-nobodys-building-1hl9)
- [From HTML to 8K Video with Puppeteer + FFmpeg](https://medium.com/@BBSRGUY/from-html-to-8k-video-turning-websites-web-animations-into-cinematic-movies-with-puppeteer-34c3b6d1349f)
