import { create } from 'zustand';
import type { ChatMessage } from '../types';

interface ChatStore {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  suggestions: string[];

  toggleChat: () => void;
  openChat: () => void;
  addMessage: (msg: ChatMessage) => void;
  setLoading: (v: boolean) => void;
  setSuggestions: (s: string[]) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isOpen: false,
  isLoading: false,
  suggestions: [],

  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  openChat: () => set({ isOpen: true }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setLoading: (v) => set({ isLoading: v }),
  setSuggestions: (s) => set({ suggestions: s }),
  clearMessages: () => set({ messages: [] }),
}));
