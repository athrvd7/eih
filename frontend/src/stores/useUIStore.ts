import { create } from 'zustand';

type RightPanel = 'node-details' | 'walkthrough' | 'docs' | 'ask' | null;

interface UIStore {
  rightPanel: RightPanel;
  isLeftSidebarOpen: boolean;
  sidebarWidth: number;
  inspectorActiveTab: string;
  chatDrawerOpen: boolean;
  chatDrawerHeight: number;

  setRightPanel: (panel: RightPanel) => void;
  toggleLeftSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setInspectorActiveTab: (tab: string) => void;
  setChatDrawerOpen: (open: boolean) => void;
  toggleChatDrawer: () => void;
  setChatDrawerHeight: (h: number) => void;
}

const STORAGE_KEY = 'eih-ui-prefs';

function loadPrefs(): Partial<UIStore> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const prefs = JSON.parse(raw);
    return {
      isLeftSidebarOpen: prefs.isLeftSidebarOpen ?? true,
      sidebarWidth: prefs.sidebarWidth ?? 260,
      inspectorActiveTab: prefs.inspectorActiveTab ?? 'overview',
      chatDrawerOpen: prefs.chatDrawerOpen ?? false,
      chatDrawerHeight: prefs.chatDrawerHeight ?? 300,
    };
  } catch {
    return {};
  }
}

function savePrefs(state: Partial<UIStore>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      isLeftSidebarOpen: state.isLeftSidebarOpen,
      sidebarWidth: state.sidebarWidth,
      inspectorActiveTab: state.inspectorActiveTab,
      chatDrawerOpen: state.chatDrawerOpen,
      chatDrawerHeight: state.chatDrawerHeight,
    }));
  } catch {}
}

const defaults = loadPrefs();

export const useUIStore = create<UIStore>((set) => ({
  rightPanel: null,
  isLeftSidebarOpen: defaults.isLeftSidebarOpen ?? true,
  sidebarWidth: defaults.sidebarWidth ?? 260,
  inspectorActiveTab: defaults.inspectorActiveTab ?? 'overview',
  chatDrawerOpen: defaults.chatDrawerOpen ?? false,
  chatDrawerHeight: defaults.chatDrawerHeight ?? 300,

  setRightPanel: (panel) => set({ rightPanel: panel }),
  toggleLeftSidebar: () => set((s) => {
    const next = { isLeftSidebarOpen: !s.isLeftSidebarOpen };
    savePrefs({ ...s, ...next });
    return next;
  }),
  setSidebarWidth: (w) => set((s) => {
    const next = { sidebarWidth: Math.max(200, Math.min(400, w)) };
    savePrefs({ ...s, ...next });
    return next;
  }),
  setInspectorActiveTab: (tab) => set((s) => {
    const next = { inspectorActiveTab: tab };
    savePrefs({ ...s, ...next });
    return next;
  }),
  setChatDrawerOpen: (open) => set((s) => {
    const next = { chatDrawerOpen: open };
    savePrefs({ ...s, ...next });
    return next;
  }),
  toggleChatDrawer: () => set((s) => {
    const next = { chatDrawerOpen: !s.chatDrawerOpen };
    savePrefs({ ...s, ...next });
    return next;
  }),
  setChatDrawerHeight: (h) => set((s) => {
    const next = { chatDrawerHeight: Math.max(150, Math.min(600, h)) };
    savePrefs({ ...s, ...next });
    return next;
  }),
}));
