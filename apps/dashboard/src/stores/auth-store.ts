import { create } from "zustand";

export interface SessionUser {
  email: string;
  role: string;
  workspaceId: string;
  workspaceName: string;
  plan: string;
}

interface AuthState {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));
