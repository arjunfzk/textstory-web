/**
 * Zustand store for the chat editor.
 *
 * Single source of truth for the conversation being edited.
 * Persisted to localStorage via zustand/persist so drafts
 * survive page refreshes and tab closes.
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatContact, ChatMessage, ChatStyle, ImageMessage, MessageSender, TextMessage } from '@/lib/types';

interface ChatStore {
  // --- State ---
  messages: ChatMessage[];
  contact: ChatContact;
  style: ChatStyle;
  currentSender: MessageSender;

  // --- Actions ---
  addMessage: (text: string) => void;
  addImageMessage: (imageUrl: string, width?: number, height?: number) => void;
  removeMessage: (id: string) => void;
  moveMessage: (id: string, direction: 'up' | 'down') => void;
  toggleSender: () => void;
  setContact: (update: Partial<ChatContact>) => void;
  setStyle: (style: ChatStyle) => void;
  clearMessages: () => void;

  /** Returns a frozen snapshot for export (prevents race conditions). */
  getConversationSnapshot: () => {
    messages: ChatMessage[];
    contact: ChatContact;
    style: ChatStyle;
  };
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      contact: { name: 'Jane' },
      style: 'imessage',
      currentSender: 'you',

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

      removeMessage: (id: string) => {
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== id),
        }));
      },

      moveMessage: (id: string, direction: 'up' | 'down') => {
        set((state) => {
          const idx = state.messages.findIndex((m) => m.id === id);
          if (idx === -1) return state;

          const newIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (newIdx < 0 || newIdx >= state.messages.length) return state;

          const copy = [...state.messages];
          [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
          return { messages: copy };
        });
      },

      toggleSender: () => {
        set((state) => ({
          currentSender: state.currentSender === 'you' ? 'friend' : 'you',
        }));
      },

      setContact: (update: Partial<ChatContact>) => {
        set((state) => ({
          contact: { ...state.contact, ...update },
        }));
      },

      setStyle: (style: ChatStyle) => set({ style }),

      clearMessages: () => set({ messages: [] }),

      getConversationSnapshot: () => {
        const { messages, contact, style } = get();
        return structuredClone({ messages, contact, style });
      },
    }),
    {
      name: 'textstory-draft',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        let state = persisted as { messages?: Array<Record<string, unknown>> };
        if (version === 1) {
          // v1 → v2: Add kind: 'text' to all existing messages
          if (Array.isArray(state.messages)) {
            state = {
              ...state,
              messages: state.messages.map((m) => ({
                ...m,
                kind: m.kind ?? 'text',
              })),
            };
          }
        }
        return state as unknown as ChatStore;
      },
      partialize: (state): Partial<ChatStore> => ({
        messages: state.messages,
        contact: state.contact,
        style: state.style,
        currentSender: state.currentSender,
      }),
    },
  ),
);
