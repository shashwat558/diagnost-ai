import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Instruction {
  id: string;
  name: string;
  handles_intent: string;
  current_version: string;
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

export function useInstructions() {
  return useQuery({
    queryKey: ["instructions"],
    queryFn: () => fetchJson<Instruction[]>("/api/instructions"),
  });
}

export function useAddInstruction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; handles_intent: string; content: string }) =>
      fetchJson<Instruction>("/api/instructions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructions"] }),
  });
}
