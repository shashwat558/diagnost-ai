import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface ClusterSummary {
  id: string;
  intent: string;
  size: number;
  error_rate: number;
  summary: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function useClusters() {
  return useQuery({
    queryKey: ["clusters"],
    queryFn: () => fetchJson<ClusterSummary[]>("/api/clusters"),
  });
}

export function useCluster(id: string) {
  return useQuery({
    queryKey: ["cluster", id],
    queryFn: () => fetchJson<ClusterSummary>(`/api/clusters/${id}`),
    enabled: !!id,
  });
}

export function useInvalidateClusters() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["clusters"] });
}
