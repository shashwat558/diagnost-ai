import { useQuery } from "@tanstack/react-query";

export interface FeatureRequest {
  slug: string;
  frequency: number;
  description: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function useFeatures() {
  return useQuery({
    queryKey: ["features"],
    queryFn: () => fetchJson<FeatureRequest[]>("/api/features"),
  });
}
