/**
 * Core type definitions for TextStory Web.
 *
 * This file is the single source of truth for all data shapes shared
 * between the editor, export renderer, timeline compiler, audio mixer,
 * and video pipeline. It has ZERO runtime dependencies.
 */

// ---------------------------------------------------------------------------
// Conversation types (editor produces, export consumes)
// ---------------------------------------------------------------------------

/** Who sent the message. */
export type MessageSender = 'you' | 'friend';

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

/** Contact info for the chat partner. */
export interface ChatContact {
  name: string;
  /** Server-side URL to uploaded + normalized profile image, or undefined. */
  profileImageUrl?: string;
}

/** Which chat app style to render. */
export type ChatStyle = 'imessage' | 'whatsapp' | 'instagram';

/** Full conversation state — editor produces this, export consumes it. */
export interface Conversation {
  messages: ChatMessage[];
  contact: ChatContact;
  style: ChatStyle;
}

// ---------------------------------------------------------------------------
// Timeline types (compiler output, pipeline input)
// ---------------------------------------------------------------------------

/** A sound to play at a specific point in the timeline. */
export interface AudioEvent {
  type: 'keystroke' | 'swoosh' | 'receive';
  /** Which sound variant (future: keystroke has multiple variants). */
  soundIndex: number;
}

/** Output of TimelineCompiler — one entry per visual state change. */
export interface TimelineEntry {
  /** Unique visual state ID (used for frame deduplication). */
  id: string;
  /** What kind of visual change this represents. */
  type:
    | 'empty'
    | 'breathing'
    | 'friend-typing'
    | 'friend-bubble'
    | 'you-typing'
    | 'you-bubble'
    | 'read-pause';
  /** Which message index this relates to (null for empty/breathing). */
  messageIndex: number | null;
  /** For you-typing: how many characters are visible in the composer. */
  charsVisible?: number;
  /** For friend-typing: animation frame index (dynamic count based on message length). */
  typingFrame?: number;
  /** How many video frames to HOLD this visual state. */
  holdFrames: number;
  /** Audio events that fire when this entry starts rendering. */
  audioEvents: AudioEvent[];
  /**
   * Number of messages visible in the chat at this point.
   * The renderer slices conversation.messages[0..visibleMessageCount] to display.
   * Using a count instead of a full array avoids quadratic memory growth.
   */
  visibleMessageCount: number;
  /** Whether the typing indicator bubble is shown. */
  showTypingIndicator: boolean;
  /** Text currently displayed in the composer bar (null = empty/hidden). */
  composerText: string | null;
}

// ---------------------------------------------------------------------------
// Export job types (API ↔ frontend contract)
// ---------------------------------------------------------------------------

/** Export job lifecycle status. */
export type ExportStatus =
  | 'queued'
  | 'compiling'
  | 'rendering'
  | 'encoding'
  | 'complete'
  | 'error';

/**
 * Export job state returned by GET /api/export/[jobId].
 *
 * Discriminated union ensures 'complete' always has downloadUrl
 * and 'error' always has an error message.
 */
export type ExportJob =
  | { id: string; status: 'queued' | 'compiling' | 'rendering' | 'encoding'; progress: number }
  | { id: string; status: 'complete'; progress: 100; downloadUrl: string }
  | { id: string; status: 'error'; progress: number; error: string };

/**
 * Self-contained export manifest written to disk per job.
 *
 * In V2 the worker service reads this directly from a shared volume,
 * so the interface serves as the contract boundary between web app
 * and render worker.
 */
export interface ExportManifest {
  jobId: string;
  conversation: Conversation;
  /** Paths to normalized assets within the job workspace directory. */
  assets: {
    contactPhoto?: string;
  };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Style tokens (shared between editor and export components)
// ---------------------------------------------------------------------------

/** Visual configuration for a chat style — pure data, no React. */
export interface StyleTokens {
  name: string;
  headerBg: string;
  headerText: string;
  chatBg: string;
  youBubbleBg: string;
  youBubbleText: string;
  friendBubbleBg: string;
  friendBubbleText: string;
  bubbleRadius: number;
  fontFamily: string;
  fontSize: number;
  avatarSize: number;
  /** Whether to show the contact avatar next to friend's message bubbles. */
  showAvatarOnBubble: boolean;
  /** Background for the typing indicator bubble. */
  typingIndicatorBg: string;
}
