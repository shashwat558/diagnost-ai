"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Sparkline } from "@/components/sparkline";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiStore } from "@/stores/ui-store";
import type { IntentRow } from "@/lib/intents";

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function IntentsTable({ rows }: { rows: IntentRow[] }) {
  const q = useUiStore((s) => s.clusterFilter);
  const setQ = useUiStore((s) => s.setClusterFilter);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.intent.toLowerCase().includes(needle) ||
        r.summary.toLowerCase().includes(needle) ||
        r.top_terms.join(" ").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  return (
    <>
      <div className="flex items-center gap-2 px-6">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="pl-9"
          />
        </div>
        <Button variant="outline">Export CSV</Button>
        <Button>+ New instruction</Button>
      </div>

      <div className="mt-4 px-6 pb-10">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-gray-500">
              <th className="w-8 border-b border-gray-200 py-2"></th>
              <th className="border-b border-gray-200 py-2 pr-4 font-normal">User intent</th>
              <th className="border-b border-gray-200 py-2 pr-4 text-right font-normal"># Conversations</th>
              <th className="border-b border-gray-200 py-2 pr-4 font-normal">Trend</th>
              <th className="border-b border-gray-200 py-2 pr-4 font-normal">vs Prior 1 day</th>
              <th className="border-b border-gray-200 py-2 pr-4 font-normal">Error rate</th>
              <th className="border-b border-gray-200 py-2 font-normal">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const suggested = r.frustration >= 0.5;
              const delta = r.deltaPct;
              return (
                <tr key={r.id} className="group hover:bg-gray-50">
                  <td className="border-b border-gray-100 py-2.5 align-middle">
                    <span className="ml-1 inline-block h-3.5 w-3.5 rounded-full border border-gray-300" />
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4">
                    <Link
                      href={`/clusters/${r.id}`}
                      className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-500"
                    >
                      {r.intent.replace(/_/g, " ")}
                    </Link>
                    {suggested && (
                      <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                        Suggested
                      </span>
                    )}
                    <span className="mt-0.5 block max-w-lg truncate text-[12px] text-gray-500">{r.summary}</span>
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4 text-right tabular-nums text-gray-700">
                    {Number(r.size)}
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4">
                    <Sparkline
                      points={r.daily}
                      color={r.error_rate > 0.4 ? "#ef4444" : r.deltaPct !== null && r.deltaPct < 0 ? "#ef4444" : "#10b981"}
                    />
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4">
                    {delta === null ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className={delta < 0 ? "text-red-600" : delta > 0 ? "text-emerald-600" : "text-gray-500"}>
                        {delta > 0 ? "+" : ""}
                        {delta}%
                      </span>
                    )}
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4 tabular-nums text-gray-700">
                    {(r.error_rate * 100).toFixed(0)}%
                  </td>
                  <td className="border-b border-gray-100 py-2.5 text-gray-500">{relTime(r.lastSeen)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-gray-400">
                  No intents match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
