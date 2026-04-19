# Image Messages — Design Spec

## Overview

Add image message support to TextStory Web conversations. Users can send images alongside text messages. Images appear as rounded bubbles in the chat, skip the typing animation, and export deterministically to video.

## Type System

`ChatMessage` becomes a discriminated union with a `kind` field:

```ts
type ChatMessage = TextMessage | ImageMessage;

interface TextMessage {
  id: string;
  sender: MessageSender;
  kind: 'text';
  text: string;
}

interface ImageMessage {
  id: string;
  sender: MessageSender;
  kind: 'image';
  imageUrl: string;
  /** Original dimensions for aspect-ratio layout. */
  width?: number;
  height?: number;
}
```

**Migration:** Existing persisted drafts in localStorage have no `kind` field. The Zustand `migrate` function (version bump 1 → 2) adds `kind: 'text'` to all existing messages.

## Store Changes (`store/chat-store.ts`)

- `addMessage(text)` sets `kind: 'text'` on new messages.
- New action `addImageMessage(imageUrl: string, width?: number, height?: number)` creates an `ImageMessage` with the current sender.
- `getConversationSnapshot()` works unchanged — `structuredClone` handles both shapes.

## Editor UI (`ChatEditor.tsx`)

Add an image upload button in the "Add Dialogue" section, below the textarea, next to the POST button:

- Button with image icon, styled to match Obsidian Gold.
- Opens a file picker (`accept="image/*"`).
- Uploads via existing `POST /api/upload` (Sharp EXIF strip + resize).
- On success, calls `addImageMessage(serverUrl, width, height)`.
- Shows a brief loading state on the button during upload.

## Message Bubble Rendering

### Editor (`MessageBubble.tsx`)

Branch on `message.kind`:

- `'text'` (or undefined for backwards compat): render text as today.
- `'image'`: render `<img>` with:
  - `max-width: 200px`, aspect ratio preserved via `width`/`height` attrs.
  - Rounded corners matching the style's `bubbleRadius`.
  - Same alignment (you = right, friend = left).
  - No text content.

### Export (`ExportBubble.tsx`)

Same branching logic. Uses plain `<img>` (NOT next/image) for Puppeteer determinism. Inline styles only.

## Timeline Compiler (`timeline-compiler.ts`)

Image messages get a simplified animation sequence:

1. **Breathing gap** (same `BREATHING_GAP_FRAMES` = 24 frames / 1 second).
2. **No typing indicator** — neither "you-typing" nor "friend-typing" entries.
3. **Bubble appear** — single entry with:
   - `type: 'you-bubble'` or `'friend-bubble'`
   - `holdFrames`: fixed `IMAGE_READ_PAUSE_FRAMES` (36 frames / 1.5 seconds) — not character-based since images have no text.
   - `audioEvents`: `[{ type: 'swoosh', soundIndex: 0 }]` for you, `[{ type: 'receive', soundIndex: 0 }]` for friend.

New constant: `IMAGE_READ_PAUSE_FRAMES: 36` added to the frozen `TIMELINE` object.

The compiler branches on `msg.kind` (defaulting to `'text'` if `kind` is absent for backwards compat with any in-flight data).

## API Validation (`app/api/export/route.ts`)

Update the Zod schema to validate the discriminated union:

```ts
const messageSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('text'),
    text: z.string().min(1),
    sender: z.enum(['you', 'friend']),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('image'),
    imageUrl: z.string().url(),
    sender: z.enum(['you', 'friend']),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }),
]);
```

## Tests (`timeline-compiler.test.ts`)

New test cases:

1. Image message produces no typing entries, just breathing + bubble.
2. Image message has correct audio event (swoosh for you, receive for friend).
3. Image message holdFrames equals `IMAGE_READ_PAUSE_FRAMES`.
4. Mixed text + image conversation compiles correctly.
5. Legacy message without `kind` field treated as text.

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | `ChatMessage` → discriminated union, export `TextMessage` + `ImageMessage` |
| `store/chat-store.ts` | `addImageMessage()`, migration v1→v2, `kind: 'text'` in `addMessage` |
| `components/editor/ChatEditor.tsx` | Image upload button in "Add Dialogue" |
| `components/editor/MessageBubble.tsx` | Branch on `kind` for image rendering |
| `components/export/ExportBubble.tsx` | Branch on `kind` with plain `<img>` |
| `lib/timeline-compiler.ts` | Image branch in `compileTimeline()`, `IMAGE_READ_PAUSE_FRAMES` constant |
| `app/api/export/route.ts` | `z.discriminatedUnion` schema |
| `lib/__tests__/timeline-compiler.test.ts` | 5 new test cases |

## Architecture Rules (Preserved)

- `lib/` never imports from `components/`, `store/`, or `app/`.
- Export components use inline styles, plain `<img>`.
- TimelineCompiler remains a pure function.
- Frame acknowledgement unchanged.
- Snapshot isolation via `structuredClone()` unchanged.
