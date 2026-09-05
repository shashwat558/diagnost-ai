"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkline } from "@/components/sparkline";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpTip } from "@/components/ui/help-tip";
import { NewInstructionDialog } from "@/components/instructions/new-instruction-dialog";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  const intents = useMemo(() => [...new Set(rows.map((r) => r.intent))].sort(), [rows]);

  function exportCsv() {
    const esc = (v: string | number | null) => {
      const s = v === null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      "intent,conversations,error_rate_pct,vs_prior_day_pct,last_seen,summary",
      ...filtered.map((r) =>
        [
          esc(r.intent),
          esc(r.size),
          esc((r.error_rate * 100).toFixed(1)),
          esc(r.deltaPct),
          esc(r.lastSeen),
          esc(r.summary),
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
        <Button
          onClick={() => {
            setNotice(null);
            setDialogOpen(true);
          }}
        >
          + New instruction
        </Button>
      </div>

      {notice && (
        <div className="mx-6 mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
          {notice}
        </div>
      )}

      <div className="mt-4 px-6 pb-10">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-gray-500">
              <th className="w-8 border-b border-gray-200 py-2" title="Select for bulk actions">●</th>
              <th className="border-b border-gray-200 py-2 pr-4 font-normal">
                User intent
                <HelpTip text="A group of similar conversations, clustered automatically. Click one to see examples and failures." />
              </th>
              <th className="border-b border-gray-200 py-2 pr-4 text-right font-normal"># Conversations</th>
              <th className="border-b border-gray-200 py-2 pr-4 font-normal">
                Trend
                <HelpTip text="Conversations per day, last 7 days. Red means a high failure share." />
              </th>
              <th className="border-b border-gray-200 py-2 pr-4 font-normal">
                vs Prior 1 day
                <HelpTip text="Change in daily volume vs yesterday. Green = growing, gray = shrinking." />
              </th>
              <th className="border-b border-gray-200 py-2 pr-4 font-normal">
                Error rate
                <HelpTip text="Share of conversations in this intent that failed." />
              </th>
              <th className="border-b border-gray-200 py-2 font-normal">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const needsInstruction = r.frustration >= 0.5;
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
                    {needsInstruction && (
                      <span
                        className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent"
                        title="Over half of rated conversations in this intent got low scores — adding an instruction gives the auto-improver something to refine."
                      >
                        Needs instruction
                      </span>
                    )}
                    <span className="mt-0.5 block max-w-lg truncate text-[12px] text-gray-500" title={r.summary}>{r.summary}</span>
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4 text-right tabular-nums text-gray-700">
                    {Number(r.size)}
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4">
                    <Sparkline
                      points={r.daily}
                      color={r.error_rate > 0.4 ? "#ef4444" : "#10b981"}
                    />
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4">
                    {delta === null ? (
                      <span className="text-gray-400" title="Not enough history yet">—</span>
                    ) : (
                      <span
                        title={delta > 0 ? "Growing vs yesterday" : delta < 0 ? "Shrinking vs yesterday" : "Flat vs yesterday"}
                        className={delta > 0 ? "text-emerald-600" : "text-gray-500"}
                      >
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

      {dialogOpen && (
        <NewInstructionDialog
          intents={intents}
          onClose={(createdName) => {
            setDialogOpen(false);
            if (createdName) {
              setNotice(
                `Instruction “${createdName}” saved as v1 — remediation runs can now propose improvements with eval reports.`
              );
            }
          }}
        />
      )}
    </>
  );
}
