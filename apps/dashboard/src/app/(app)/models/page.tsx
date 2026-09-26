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
        <h1 className="text-base font-semibold text-ink">
          Model comparison
          <HelpTip text="Your small, fast, cheap model (specialist, trained on your conversations) vs the big general model (frontier). Winner = as accurate or better, at lower cost." />
        </h1>
        <span className="text-sm text-ink-subtle">
          big model vs your fine-tuned model, tested on fresh examples
        </span>
      </div>

      {!latest && (
        <p className="mt-6 rounded-lg border border-line p-8 text-center text-sm text-ink-subtle">
          No comparisons yet — train your first specialist with{" "}
          <code className="font-mono text-sm">python3 apps/finetune/run_pipeline.py</code>,
          then come back. See <Link href="/docs">Docs</Link> for the full walkthrough.
        </p>
      )}

      {latest && frontier && specialist && (
        <>
          <table className="mt-4 w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-sm text-ink-muted">
                <th className="border-b border-line py-2 pr-4 font-normal">Model</th>
                <th className="border-b border-line py-2 pr-4 text-right font-normal">
                  Correct answers
                  <HelpTip text="Share of test questions answered correctly. Higher is better." />
                </th>
                <th className="border-b border-line py-2 pr-4 text-right font-normal">
                  Slowest 5%
                  <HelpTip text="Reply time that 95% of answers beat. Lower is faster." />
                </th>
                <th className="border-b border-line py-2 pr-4 text-right font-normal">
                  Cost / 1k answers
                  <HelpTip text="Estimated API cost per thousand answers. Lower is cheaper." />
                </th>
                <th className="border-b border-line py-2 pr-4 font-normal">Numbers from</th>
                <th className="border-b border-line py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.name} className="hover:bg-hover">
                  <td className="border-b border-line py-2.5 pr-4 font-medium text-ink">
                    {c.kind === "specialist" ? "Yours — fine-tuned router" : "Big model — frontier (gpt-4o-mini)"}
                    <span className="mt-0.5 block font-mono text-xs text-ink-subtle">{c.name}</span>
                  </td>
                  <td className="border-b border-line py-2.5 pr-4 text-right tabular-nums">
                    {(c.accuracy * 100).toFixed(1)}%
                  </td>
                  <td className="border-b border-line py-2.5 pr-4 text-right tabular-nums">
                    {c.p95_ms} ms{!c.measured_latency && <span className="text-ink-subtle"> *</span>}
                  </td>
                  <td className="border-b border-line py-2.5 pr-4 text-right tabular-nums">
                    ${c.cost_per_1k_usd.toFixed(4)}
                  </td>
                  <td className="border-b border-line py-2.5 pr-4 text-sm text-ink-muted" title={c.measured_latency ? "We timed this model on this machine." : "Vendor-published figures — we didn't time this one."}>
                    {c.measured_latency ? "timed here" : "published figures"}
                  </td>
                  <td className="border-b border-line py-2.5 text-right">
                    {latest.winner === c.name && (
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">
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
              <div key={c.name} className="rounded-lg border border-line p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink">
                    {c.kind === "specialist" ? "Yours, per topic" : "Big model, per topic"}
                  </h2>
                  <span className="text-xs text-ink-subtle" title="Fresh examples neither model saw during training">{c.total} test answers</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {Object.entries(c.per_intent).map(([intent, acc]) => (
                    <div key={intent} className="flex items-center gap-2 text-sm">
                      <span className="w-36 truncate text-ink-muted">{intent.replace(/_/g, " ")}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full ${c.kind === "specialist" ? "bg-accent" : "bg-amber-400"}`}
                          style={{ width: `${acc * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-ink-muted">
                        {(acc * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {latest.notes && (
            <p className="mt-4 text-xs leading-4 text-ink-subtle">* {latest.notes}</p>
          )}
          <p className="mt-1 text-sm text-ink-muted">
            Tested on {Number(latest.dataset_size)} fresh examples neither model had seen.
          </p>
        </>
      )}
    </div>
  );
}
