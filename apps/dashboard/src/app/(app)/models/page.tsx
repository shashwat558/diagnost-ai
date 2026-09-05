import Link from "next/link";
import { pgQuery } from "@/lib/pg";
import { HelpTip } from "@/components/ui/help-tip";

export const dynamic = "force-dynamic";

interface BenchmarkRow {
  id: string;
  task: string;
  dataset_size: number;
  candidates: Candidate[];
  winner: string;
  notes: string;
  created_at: string;
}

interface Candidate {
  name: string;
  kind: "frontier" | "specialist";
  accuracy: number;
  per_intent: Record<string, number>;
  p50_ms: number;
  p95_ms: number;
  cost_per_1k_usd: number;
  measured_latency: boolean;
  total: number;
}

export default async function ModelsPage() {
  const rows = await pgQuery<BenchmarkRow>(
    `SELECT id, task, dataset_size, candidates, winner, notes, created_at
     FROM model_benchmarks WHERE workspace_id='ws_dev'
     ORDER BY created_at DESC LIMIT 5`
  );
  const latest = rows[0];
  const candidates: Candidate[] = latest?.candidates ?? [];
  const frontier = candidates.find((c) => c.kind === "frontier");
  const specialist = candidates.find((c) => c.kind === "specialist");

  return (
    <div className="px-6 pt-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[15px] font-semibold text-gray-900">
          Model comparison
          <HelpTip text="Your small, fast, cheap model (specialist, trained on your conversations) vs the big general model (frontier). Winner = as accurate or better, at lower cost." />
        </h1>
        <span className="text-[12px] text-gray-400">
          big model vs your fine-tuned model, tested on fresh examples
        </span>
      </div>

      {!latest && (
        <p className="mt-6 rounded-lg border border-gray-200 p-8 text-center text-[13px] text-gray-400">
          No comparisons yet — train your first specialist with{" "}
          <code className="font-mono text-[12px]">python3 apps/finetune/run_pipeline.py</code>,
          then come back. See <Link href="/docs">Docs</Link> for the full walkthrough.
        </p>
      )}

      {latest && frontier && specialist && (
        <>
          <table className="mt-4 w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-gray-500">
                <th className="border-b border-gray-200 py-2 pr-4 font-normal">Model</th>
                <th className="border-b border-gray-200 py-2 pr-4 text-right font-normal">
                  Correct answers
                  <HelpTip text="Share of test questions answered correctly. Higher is better." />
                </th>
                <th className="border-b border-gray-200 py-2 pr-4 text-right font-normal">
                  Slowest 5%
                  <HelpTip text="Reply time that 95% of answers beat. Lower is faster." />
                </th>
                <th className="border-b border-gray-200 py-2 pr-4 text-right font-normal">
                  Cost / 1k answers
                  <HelpTip text="Estimated API cost per thousand answers. Lower is cheaper." />
                </th>
                <th className="border-b border-gray-200 py-2 pr-4 font-normal">Numbers from</th>
                <th className="border-b border-gray-200 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.name} className="hover:bg-gray-50">
                  <td className="border-b border-gray-100 py-2.5 pr-4 font-medium text-gray-900">
                    {c.kind === "specialist" ? "Yours — fine-tuned router" : "Big model — frontier (gpt-4o-mini)"}
                    <span className="mt-0.5 block font-mono text-[11px] text-gray-400">{c.name}</span>
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4 text-right tabular-nums">
                    {(c.accuracy * 100).toFixed(1)}%
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4 text-right tabular-nums">
                    {c.p95_ms} ms{!c.measured_latency && <span className="text-gray-400"> *</span>}
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4 text-right tabular-nums">
                    ${c.cost_per_1k_usd.toFixed(4)}
                  </td>
                  <td className="border-b border-gray-100 py-2.5 pr-4 text-[12px] text-gray-500" title={c.measured_latency ? "We timed this model on this machine." : "Vendor-published figures — we didn't time this one."}>
                    {c.measured_latency ? "timed here" : "published figures"}
                  </td>
                  <td className="border-b border-gray-100 py-2.5 text-right">
                    {latest.winner === c.name && (
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                        Winner
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {candidates.map((c) => (
              <div key={c.name} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-gray-900">
                    {c.kind === "specialist" ? "Yours, per topic" : "Big model, per topic"}
                  </h2>
                  <span className="text-[11px] text-gray-400" title="Fresh examples neither model saw during training">{c.total} test answers</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {Object.entries(c.per_intent).map(([intent, acc]) => (
                    <div key={intent} className="flex items-center gap-2 text-[12px]">
                      <span className="w-36 truncate text-gray-600">{intent.replace(/_/g, " ")}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${c.kind === "specialist" ? "bg-accent" : "bg-amber-400"}`}
                          style={{ width: `${acc * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-gray-500">
                        {(acc * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {latest.notes && (
            <p className="mt-4 text-[11px] leading-4 text-gray-400">* {latest.notes}</p>
          )}
          <p className="mt-1 text-[12px] text-gray-500">
            Tested on {Number(latest.dataset_size)} fresh examples neither model had seen.
          </p>
        </>
      )}
    </div>
  );
}
