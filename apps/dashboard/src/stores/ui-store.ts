import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  clusterFilter: string;
  setClusterFilter: (q: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      clusterFilter: "",
      setClusterFilter: (clusterFilter) => set({ clusterFilter }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "diagnost-ui" }
  )
);
