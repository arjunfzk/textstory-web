# Image Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image message support to TextStory Web — users can send images in conversations that render as rounded bubbles and export to video without typing animations.

**Architecture:** `ChatMessage` becomes a discriminated union (`TextMessage | ImageMessage`) with a `kind` discriminant. The timeline compiler skips typing entries for images and uses a fixed read-pause. A new `/api/upload-image` endpoint preserves aspect ratio (unlike the existing profile upload which crops to 200x200 square).

**Tech Stack:** TypeScript, Zustand, Next.js App Router, Zod, Sharp, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/types.ts` | Modify | `ChatMessage` → discriminated union |
| `lib/timeline-compiler.ts` | Modify | Image message branch (no typing, fixed read pause) |
| `lib/__tests__/timeline-compiler.test.ts` | Modify | 5 new image message tests |
| `store/chat-store.ts` | Modify | `addImageMessage()`, migration v1→v2 |
| `app/api/upload-image/route.ts` | Create | Image upload with aspect-ratio preservation |
| `components/editor/MessageBubble.tsx` | Modify | Branch on `kind` for image rendering |
| `components/export/ExportBubble.tsx` | Modify | Branch on `kind` with plain `<img>` |
| `components/editor/ChatEditor.tsx` | Modify | Image upload button in "Add Dialogue" section |
| `app/api/export/route.ts` | Modify | Zod discriminated union schema |

---

### Task 1: Type System — ChatMessage Discriminated Union

**Files:**
- Modify: `lib/types.ts:14-21`

- [ ] **Step 1: Update ChatMessage to discriminated union**

Replace the `ChatMessage` interface in `lib/types.ts` (lines 14–21) with:

```ts
/** A text message in the conversation. */
export interface TextMessage {
  id: string;
  sender: MessageSender;
  kind: 'text';
  text: string;
}

/** An image message in the conversation. */
export interface ImageMessage {
  id: string;
  sender: MessageSender;
  kind: 'image';
  imageUrl: string;
  /** Original width in pixels — used for aspect-ratio layout. */
  width?: number;
  /** Original height in pixels — used for aspect-ratio layout. */
  height?: number;
}

/** A single chat message in the conversation. */
export type ChatMessage = TextMessage | ImageMessage;
```

- [ ] **Step 2: Run the build to see what breaks**

Run: `npx tsc --noEmit 2>&1 | head -40`

Expected: Multiple type errors where code accesses `message.text` without narrowing. This is correct — we'll fix these in subsequent tasks. Note the errors for reference but don't fix yet.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "refactor: ChatMessage to discriminated union with kind field"
```

---

### Task 2: Timeline Compiler — Image Message Support (TDD)

**Files:**
- Modify: `lib/timeline-compiler.ts:22-78` (TIMELINE constant), `lib/timeline-compiler.ts:93-193` (compileTimeline)
- Modify: `lib/__tests__/timeline-compiler.test.ts`

- [ ] **Step 1: Write failing tests for image messages**

Add these tests at the end of the `describe('compileTimeline', ...)` block in `lib/__tests__/timeline-compiler.test.ts`, before the closing `});`:

```ts
  it('compiles a friend image message with no typing indicator', () => {
    const conv: Conversation = {
      messages: [
        { id: 'img-1', sender: 'friend', kind: 'image', imageUrl: '/test.jpg' },
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    // Should have: empty + friend-bubble (NO friend-typing entries)
    const typingEntries = timeline.filter((e) => e.type === 'friend-typing');
    expect(typingEntries).toHaveLength(0);

    const bubble = timeline.find((e) => e.type === 'friend-bubble');
    expect(bubble).toBeDefined();
    expect(bubble!.visibleMessageCount).toBe(1);
    expect(bubble!.audioEvents).toEqual([{ type: 'receive', soundIndex: 0 }]);
  });

  it('compiles a you image message with no typing animation', () => {
    const conv: Conversation = {
      messages: [
        { id: 'img-2', sender: 'you', kind: 'image', imageUrl: '/test.jpg' },
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    // Should have: empty + you-bubble (NO you-typing entries)
    const typingEntries = timeline.filter((e) => e.type === 'you-typing');
    expect(typingEntries).toHaveLength(0);

    const bubble = timeline.find((e) => e.type === 'you-bubble');
    expect(bubble).toBeDefined();
    expect(bubble!.audioEvents).toEqual([{ type: 'swoosh', soundIndex: 0 }]);
  });

  it('image message uses fixed IMAGE_READ_PAUSE_FRAMES hold duration', () => {
    const conv: Conversation = {
      messages: [
        { id: 'img-3', sender: 'friend', kind: 'image', imageUrl: '/test.jpg' },
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    const bubble = timeline.find((e) => e.type === 'friend-bubble')!;
    expect(bubble.holdFrames).toBe(TIMELINE.IMAGE_READ_PAUSE_FRAMES);
  });

  it('compiles mixed text and image messages correctly', () => {
    const conv: Conversation = {
      messages: [
        { id: 'msg-0', sender: 'you', kind: 'text', text: 'Hey' },
        { id: 'img-1', sender: 'friend', kind: 'image', imageUrl: '/photo.jpg' },
        { id: 'msg-2', sender: 'friend', kind: 'text', text: 'Check this out' },
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    // Text message should have typing entries
    const youTyping = timeline.filter((e) => e.type === 'you-typing');
    expect(youTyping.length).toBeGreaterThan(0);

    // Image message should NOT have typing entries
    // But text friend message should have typing entries
    const friendTyping = timeline.filter((e) => e.type === 'friend-typing');
    // Only the text friend message ("Check this out") produces typing entries
    expect(friendTyping.length).toBeGreaterThan(0);

    // 2 breathing gaps (between msg 0-1 and 1-2)
    const breathing = timeline.filter((e) => e.type === 'breathing');
    expect(breathing).toHaveLength(2);

    // 3 bubbles total
    const bubbles = timeline.filter(
      (e) => e.type === 'you-bubble' || e.type === 'friend-bubble',
    );
    expect(bubbles).toHaveLength(3);
  });

  it('treats messages without kind field as text (backwards compat)', () => {
    const conv: Conversation = {
      messages: [
        // Simulate legacy message without kind field
        { id: 'legacy-0', sender: 'you', text: 'Old message' } as ChatMessage,
      ],
      contact: { name: 'Jane' },
      style: 'imessage',
    };
    const timeline = compileTimeline(conv);

    // Should compile as text — with typing entries
    const typingEntries = timeline.filter((e) => e.type === 'you-typing');
    expect(typingEntries.length).toBeGreaterThan(0);
  });
```

Also update the `makeConversation` helper at the top of the file to include `kind: 'text'`:

```ts
function makeConversation(
  messages: Array<{ text: string; sender: 'you' | 'friend' }>,
): Conversation {
  return {
    messages: messages.map((m, i) => ({
      id: `msg-${i}`,
      kind: 'text' as const,
      text: m.text,
      sender: m.sender,
    })),
    contact: { name: 'Jane' },
    style: 'imessage',
  };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -20`

Expected: The 5 new tests fail (type errors and missing `IMAGE_READ_PAUSE_FRAMES`). The 16 existing tests may also fail due to the `ChatMessage` type change needing `kind` field.

- [ ] **Step 3: Add IMAGE_READ_PAUSE_FRAMES constant**

In `lib/timeline-compiler.ts`, add this inside the `TIMELINE` frozen object (after `TYPING_DOT_CYCLE_FRAMES: 12,`):

```ts
  /**
   * Read pause for image messages — fixed duration since images have no text.
   * 36 frames = 1.5 seconds at 24fps.
   */
  IMAGE_READ_PAUSE_FRAMES: 36,
```

- [ ] **Step 4: Add image branch in compileTimeline**

In `lib/timeline-compiler.ts`, replace the message loop body inside `compileTimeline` (the `for` loop starting around line 105) with:

```ts
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const visibleBefore = i;
    const visibleAfter = i + 1;

    // Breathing gap between messages (skip for first)
    if (i > 0) {
      entries.push(makeEntry({
        id: `breathing-${i}`,
        type: 'breathing',
        holdFrames: TIMELINE.BREATHING_GAP_FRAMES,
        visibleMessageCount: visibleBefore,
      }));
    }

    // Image messages: no typing animation, just instant bubble appear
    const msgKind = 'kind' in msg ? msg.kind : 'text';
    if (msgKind === 'image') {
      const bubbleType = msg.sender === 'friend' ? 'friend-bubble' : 'you-bubble';
      const soundType = msg.sender === 'friend' ? 'receive' : 'swoosh';
      entries.push(makeEntry({
        id: `${bubbleType}-${i}`,
        type: bubbleType,
        messageIndex: i,
        holdFrames: TIMELINE.IMAGE_READ_PAUSE_FRAMES,
        visibleMessageCount: visibleAfter,
        audioEvents: [{ type: soundType, soundIndex: 0 }],
      }));
      continue;
    }

    if (msg.sender === 'friend') {
      // Friend typing indicator — duration proportional to message length
      const text = 'text' in msg ? msg.text : '';
      const friendTypingFrames = calculateFriendTypingFrames(text);
      for (let f = 0; f < friendTypingFrames; f++) {
        entries.push(makeEntry({
          id: `friend-typing-${i}-${f}`,
          type: 'friend-typing',
          messageIndex: i,
          typingFrame: f,
          holdFrames: 1,
          visibleMessageCount: visibleBefore,
          showTypingIndicator: true,
        }));
      }

      // Friend bubble appears
      entries.push(makeEntry({
        id: `friend-bubble-${i}`,
        type: 'friend-bubble',
        messageIndex: i,
        holdFrames: calculateReadPauseFrames(text),
        visibleMessageCount: visibleAfter,
        audioEvents: [{ type: 'receive', soundIndex: 0 }],
      }));
    } else {
      // You typing — character by character using grapheme segmentation
      const text = 'text' in msg ? msg.text : '';
      const graphemes = splitGraphemes(text);
      for (let c = 0; c < graphemes.length; c++) {
        const isPunctuation = PUNCTUATION_SET.has(graphemes[c]);
        const hold = isPunctuation
          ? TIMELINE.YOU_CHAR_HOLD_FRAMES + TIMELINE.PUNCTUATION_EXTRA_FRAMES
          : TIMELINE.YOU_CHAR_HOLD_FRAMES;

        entries.push(makeEntry({
          id: `you-typing-${i}-${c}`,
          type: 'you-typing',
          messageIndex: i,
          charsVisible: c + 1,
          holdFrames: hold,
          visibleMessageCount: visibleBefore,
          composerText: null,
          audioEvents: [{ type: 'keystroke', soundIndex: c % 4 }],
        }));
      }

      // Pause before send
      entries.push(makeEntry({
        id: `you-send-pause-${i}`,
        type: 'you-typing',
        messageIndex: i,
        charsVisible: graphemes.length,
        holdFrames: TIMELINE.YOU_SEND_PAUSE_FRAMES,
        visibleMessageCount: visibleBefore,
        composerText: null,
      }));

      // You bubble appears
      entries.push(makeEntry({
        id: `you-bubble-${i}`,
        type: 'you-bubble',
        messageIndex: i,
        holdFrames: calculateReadPauseFrames(text),
        visibleMessageCount: visibleAfter,
        audioEvents: [{ type: 'swoosh', soundIndex: 0 }],
      }));
    }
  }
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `npm test 2>&1 | tail -20`

Expected: All 30 tests pass (25 existing + 5 new).

- [ ] **Step 6: Commit**

```bash
git add lib/timeline-compiler.ts lib/__tests__/timeline-compiler.test.ts
git commit -m "feat: image message support in timeline compiler (no typing, fixed pause)"
```

---

### Task 3: Zustand Store — addImageMessage + Migration

**Files:**
- Modify: `store/chat-store.ts`

- [ ] **Step 1: Add `kind: 'text'` to addMessage and add addImageMessage**

In `store/chat-store.ts`, update the interface to add the new action:

```ts
import type { ChatContact, ChatMessage, ChatStyle, ImageMessage, MessageSender, TextMessage } from '@/lib/types';
```

Add to the `ChatStore` interface, after `addMessage`:

```ts
  addImageMessage: (imageUrl: string, width?: number, height?: number) => void;
```

Update the `addMessage` implementation to include `kind: 'text'`:

```ts
      addMessage: (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const message: TextMessage = {
          id: crypto.randomUUID(),
          kind: 'text',
          text: trimmed,
          sender: get().currentSender,
        };
        set((state) => ({ messages: [...state.messages, message] }));
      },
```

Add the new `addImageMessage` action right after `addMessage`:

```ts
      addImageMessage: (imageUrl: string, width?: number, height?: number) => {
        const message: ImageMessage = {
          id: crypto.randomUUID(),
          kind: 'image',
          imageUrl,
          sender: get().currentSender,
          ...(width != null && { width }),
          ...(height != null && { height }),
        };
        set((state) => ({ messages: [...state.messages, message] }));
      },
```

- [ ] **Step 2: Add localStorage migration v1 → v2**

Update the persist config at the bottom of `chat-store.ts`:

```ts
    {
      name: 'textstory-draft',
      version: 2,
      migrate: (persisted: Record<string, unknown>, version: number) => {
        if (version < 2) {
          // v1 → v2: Add kind: 'text' to all existing messages
          const state = persisted as { messages?: Array<Record<string, unknown>> };
          if (Array.isArray(state.messages)) {
            state.messages = state.messages.map((m) => ({
              ...m,
              kind: m.kind ?? 'text',
            }));
          }
        }
        return persisted as ChatStore;
      },
      partialize: (state) => ({
        messages: state.messages,
        contact: state.contact,
        style: state.style,
        currentSender: state.currentSender,
      }),
    },
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: Store compiles. Other files may still have errors (MessageBubble, ExportBubble accessing `message.text` without narrowing).

- [ ] **Step 4: Commit**

```bash
git add store/chat-store.ts
git commit -m "feat: addImageMessage store action + localStorage migration v1→v2"
```

---

### Task 4: Editor MessageBubble — Image Rendering

**Files:**
- Modify: `components/editor/MessageBubble.tsx`

- [ ] **Step 1: Update MessageBubble to branch on kind**

Replace the component body in `components/editor/MessageBubble.tsx`:

```tsx
export function MessageBubble({
  message,
  tokens,
  style,
  contactName,
  contactImage,
}: MessageBubbleProps) {
  const isYou = message.sender === 'you';
  const isImage = message.kind === 'image';

  return (
    <div className={`flex ${isYou ? 'justify-end' : 'justify-start'} px-2.5`}>
      {/* Friend avatar (Instagram only) */}
      {!isYou && tokens.showAvatarOnBubble && (
        <div
          className="shrink-0 rounded-full overflow-hidden mr-1.5 mt-auto mb-0.5"
          style={{ width: 24, height: 24 }}
        >
          {contactImage ? (
            <img src={contactImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-[9px] font-bold bg-gradient-to-br from-purple-400 to-pink-400 text-white"
            >
              {contactName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Bubble with style-specific shape */}
      {isImage ? (
        <div
          className="max-w-[200px] overflow-hidden"
          style={{
            borderRadius: tokens.bubbleRadius,
          }}
        >
          <img
            src={message.imageUrl}
            alt=""
            className="block w-full h-auto"
            style={{
              ...(message.width && message.height
                ? { aspectRatio: `${message.width} / ${message.height}` }
                : {}),
            }}
          />
        </div>
      ) : (
        <div
          className="max-w-[72%] break-words relative"
          style={{
            backgroundColor: isYou ? tokens.youBubbleBg : tokens.friendBubbleBg,
            color: isYou ? tokens.youBubbleText : tokens.friendBubbleText,
            fontFamily: tokens.fontFamily,
            fontSize: tokens.fontSize,
            lineHeight: 1.35,
            ...getBubbleStyle(style, isYou),
          }}
        >
          {message.text}

          {/* WhatsApp timestamp + check marks */}
          {style === 'whatsapp' && (
            <span className="inline-flex items-center gap-0.5 ml-2 align-bottom text-[10px] opacity-50 whitespace-nowrap float-right mt-1">
              {formatTime()}
              {isYou && (
                <svg width="14" height="8" viewBox="0 0 16 8" fill="currentColor" opacity="0.7">
                  <path d="M1 4l3 3L11 1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                  <path d="M5 4l3 3L15 1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                </svg>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles for this file**

Run: `npx tsc --noEmit 2>&1 | grep MessageBubble`

Expected: No errors for MessageBubble.tsx.

- [ ] **Step 3: Commit**

```bash
git add components/editor/MessageBubble.tsx
git commit -m "feat: image bubble rendering in editor MessageBubble"
```

---

### Task 5: Export Bubble — Image Rendering for Puppeteer

**Files:**
- Modify: `components/export/ExportBubble.tsx`

- [ ] **Step 1: Update ExportBubble to branch on kind**

Replace the component body in `components/export/ExportBubble.tsx`:

```tsx
export function ExportBubble({
  message,
  tokens,
  style,
  contactName,
  contactImage,
}: ExportBubbleProps) {
  const isYou = message.sender === 'you';
  const isImage = message.kind === 'image';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isYou ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        paddingLeft: 10,
        paddingRight: 10,
      }}
    >
      {/* Friend avatar (Instagram only) */}
      {!isYou && tokens.showAvatarOnBubble && (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            marginRight: 6,
            marginBottom: 2,
          }}
        >
          {contactImage ? (
            <img src={contactImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #A855F7, #EC4899)',
                color: '#FFFFFF',
              }}
            >
              {contactName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Bubble */}
      {isImage ? (
        <div
          style={{
            maxWidth: '72%',
            overflow: 'hidden',
            borderRadius: tokens.bubbleRadius,
          }}
        >
          <img
            src={message.imageUrl}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              ...(message.width && message.height
                ? { aspectRatio: `${message.width} / ${message.height}` }
                : {}),
            }}
          />
        </div>
      ) : (
        <div style={getBubbleInlineStyle(style, isYou, tokens)}>
          {message.text}
          {/* WhatsApp timestamp */}
          {style === 'whatsapp' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                marginLeft: 8,
                fontSize: 10,
                opacity: 0.5,
                whiteSpace: 'nowrap',
                float: 'right',
                marginTop: 4,
              }}
            >
              10:30
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep ExportBubble`

Expected: No errors for ExportBubble.tsx.

- [ ] **Step 3: Commit**

```bash
git add components/export/ExportBubble.tsx
git commit -m "feat: image bubble rendering in ExportBubble (plain img for Puppeteer)"
```

---

### Task 6: Image Upload API Endpoint

**Files:**
- Create: `app/api/upload-image/route.ts`

- [ ] **Step 1: Create the image upload endpoint**

Create `app/api/upload-image/route.ts`:

```ts
/**
 * POST /api/upload-image — message image upload endpoint.
 *
 * Unlike /api/upload (profile photos, 200x200 square crop), this endpoint
 * preserves aspect ratio and returns original dimensions for layout.
 * Max dimension: 800px on longest side.
 * Saves to /tmp/textstory/uploads/{uuid}/image.jpg.
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = '/tmp/textstory/uploads';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (larger than profile photos)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_DIMENSION = 800;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP, and GIF images are allowed' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Image must be under 5MB' },
        { status: 400 },
      );
    }

    const sessionId = crypto.randomUUID();
    const sessionDir = join(UPLOAD_DIR, sessionId);
    await mkdir(sessionDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate pixel count
    const metadata = await sharp(buffer).metadata();
    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
    if (pixels > 25_000_000) {
      return NextResponse.json(
        { error: 'Image dimensions too large (max ~5000x5000)' },
        { status: 400 },
      );
    }

    const outputPath = join(sessionDir, 'image.jpg');

    // Resize preserving aspect ratio — fit inside MAX_DIMENSION box
    const resized = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    const url = `/api/upload/${sessionId}/image.jpg`;

    return NextResponse.json({
      url,
      width: resized.width,
      height: resized.height,
    });
  } catch (err) {
    console.error('Image upload failed:', err);
    return NextResponse.json(
      { error: 'Image upload processing failed' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Update the existing upload serving route to also serve image.jpg**

Read `app/api/upload/[sessionId]/route.ts` to verify it serves any file in the session directory. If it uses a hardcoded `photo.jpg` filename, update it to accept any filename. (The current route pattern `[sessionId]` may already handle this — verify by reading the file.)

- [ ] **Step 3: Verify dev server starts**

Run: `npm run dev &` then `curl -s http://localhost:3000/api/upload-image -X POST | head -5` (expect a 400 "No file provided" error — confirms the route is registered).

Kill the dev server after.

- [ ] **Step 4: Commit**

```bash
git add app/api/upload-image/route.ts
git commit -m "feat: image upload endpoint with aspect-ratio preservation"
```

---

### Task 7: Editor UI — Image Upload Button

**Files:**
- Modify: `components/editor/ChatEditor.tsx`

- [ ] **Step 1: Add image upload state and handler**

In `ChatEditor.tsx`, add these imports and state/refs after the existing ones:

After the existing `textareaRef`:

```tsx
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
```

Add the store selector for `addImageMessage` alongside the other selectors:

```tsx
  const addImageMessage = useChatStore((s) => s.addImageMessage);
```

Add the image upload handler after `handleContactSave`:

```tsx
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { url, width, height } = await res.json() as {
        url: string;
        width: number;
        height: number;
      };
      addImageMessage(url, width, height);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }
```

- [ ] **Step 2: Add image upload button to the Add Dialogue section**

In the "Add Dialogue" section, replace the POST button with a row containing both the POST button and an image button. Replace the existing `<button type="submit" ...>POST</button>` with:

```tsx
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
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
              />
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`

Expected: Clean or only unrelated errors.

- [ ] **Step 4: Commit**

```bash
git add components/editor/ChatEditor.tsx
git commit -m "feat: image upload button in editor Add Dialogue section"
```

---

### Task 8: Export API — Zod Discriminated Union Schema

**Files:**
- Modify: `app/api/export/route.ts:20-37`

- [ ] **Step 1: Update the Zod schema to validate the discriminated union**

Replace the `conversationSchema` in `app/api/export/route.ts`:

```ts
const messageSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('text'),
    text: z.string().min(1, 'Message text cannot be empty'),
    sender: z.enum(['you', 'friend']),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('image'),
    imageUrl: z.string().min(1, 'Image URL is required'),
    sender: z.enum(['you', 'friend']),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }),
]);

const conversationSchema = z.object({
  conversation: z.object({
    messages: z
      .array(messageSchema)
      .min(1, 'At least one message is required')
      .max(MAX_MESSAGES, `Max ${MAX_MESSAGES} messages per export`),
    contact: z.object({
      name: z.string().min(1, 'Contact name is required').max(30),
      profileImageUrl: z.string().optional(),
    }),
    style: z.enum(['imessage', 'whatsapp', 'instagram']),
  }),
});
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`

Expected: Clean build.

- [ ] **Step 3: Run all tests**

Run: `npm test 2>&1 | tail -10`

Expected: All 30 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/export/route.ts
git commit -m "feat: Zod discriminated union schema for image message validation"
```

---

### Task 9: Fix Any Remaining Type Errors

**Files:**
- Various — depends on what `tsc --noEmit` reports

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit 2>&1`

Scan for any remaining errors related to `ChatMessage`, `message.text`, or `message.kind`. Common fixes:
- Any component that accesses `message.text` without checking `message.kind !== 'image'` needs a guard.
- The export render page (`app/render/page.tsx`) may reference `message.text` — needs narrowing.
- `ExportMessageList` or similar components that iterate messages need narrowing.

- [ ] **Step 2: Fix each error with narrowing**

For each file with an error, add `message.kind !== 'image'` or `'text' in message` guards before accessing `.text`. The pattern:

```ts
// Before:
message.text

// After (where you know it's always text, e.g., composer display):
message.kind === 'text' ? message.text : ''

// Or with narrowing:
if (message.kind === 'image') {
  // render image
} else {
  // render text — TypeScript narrows to TextMessage here
  message.text  // safe
}
```

- [ ] **Step 3: Verify clean build**

Run: `npx tsc --noEmit 2>&1`

Expected: Zero errors.

- [ ] **Step 4: Run all tests**

Run: `npm test 2>&1 | tail -10`

Expected: All 30 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: narrow ChatMessage union in all components"
```

---

### Task 10: Manual Smoke Test

- [ ] **Step 1: Start dev server and test**

Run: `npm run dev`

Test the following in the browser at `http://localhost:3000/editor`:

1. Type a text message and POST — appears as text bubble in preview.
2. Click the image button — file picker opens.
3. Select an image — uploads, appears as rounded image bubble in preview.
4. Switch sender to friend, send another image — friend image bubble on left.
5. Mix text and image messages — both render correctly.
6. Refresh the page — all messages (text + image) persist from localStorage.

- [ ] **Step 2: Test export (if Puppeteer/FFmpeg available)**

1. Create a conversation with mixed text and images.
2. Click Export.
3. Verify image messages have no typing animation in the exported video.
4. Verify text messages still have typing animation.

- [ ] **Step 3: Final commit if any tweaks needed**

```bash
git add -A
git commit -m "polish: image messages smoke test fixes"
```
