import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceState {
  currentWsId: string | null;
  setCurrentWsId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWsId: null,
      setCurrentWsId: (currentWsId) => set({ currentWsId }),
    }),
    { name: "diagnost-workspace" }
  )
);
