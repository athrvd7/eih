import { create } from 'zustand';

type RightPanel = 'node-details' | 'walkthrough' | 'docs' | null;

interface UIStore {
  rightPanel: RightPanel;
  isLeftSidebarOpen: boolean;

  setRightPanel: (panel: RightPanel) => void;
  toggleLeftSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  rightPanel: null,
  isLeftSidebarOpen: true,

  setRightPanel: (panel) => set({ rightPanel: panel }),
  toggleLeftSidebar: () => set((s) => ({ isLeftSidebarOpen: !s.isLeftSidebarOpen })),
}));
