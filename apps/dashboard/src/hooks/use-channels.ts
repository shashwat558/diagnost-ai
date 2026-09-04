import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Channel {
  id: string;
  channel: string;
  target: string;
  enabled: boolean;
  created_at: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    queryFn: () => fetchJson<Channel[]>("/api/channels"),
  });
}

export function useAddChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { channel: string; target: string }) =>
      fetchJson<Channel>("/api/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });
}

export function useToggleChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      fetchJson<{ id: string; enabled: boolean }>(`/api/channels/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: true }>(`/api/channels/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });
}

export function useTestChannel() {
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: true; channel: string }>(`/api/channels/${id}/test`, {
        method: "POST",
      }),
  });
}
