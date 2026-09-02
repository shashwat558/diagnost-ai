import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";

interface Session {
  email: string;
  role: string;
  workspaceId: string;
  workspaceName: string;
  plan: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useSession() {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const data = await fetchJson<Session>("/api/auth/me");
      setUser(data);
      return data;
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      fetchJson<{ ok: true; user: Session }>("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setUser(data.user);
      qc.setQueryData(["session"], data.user);
    },
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; password: string; workspaceName?: string }) =>
      fetchJson<{ ok: true; workspaceId: string; apiKey: string; email: string }>("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session"] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: () =>
      fetchJson<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      clear();
      qc.setQueryData(["session"], null);
      qc.clear();
    },
  });
}
