"use client";

import { create } from "zustand";

type ViewMode = "cards" | "table";

type UiState = {
  sidebarCollapsed: boolean;
  projectView: ViewMode;
  toggleSidebar: () => void;
  setProjectView: (view: ViewMode) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  projectView: "cards",
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),
  setProjectView: (projectView) => set({ projectView }),
}));
