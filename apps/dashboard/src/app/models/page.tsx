import { pgQuery } from "@/lib/pg";

export const dynamic = "force-dynamic";

interface BenchmarkRow {
  id: string;
  task: string;
  dataset_size: number;
  candidates: Candidate[]; // jsonb arrives parsed
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
  const maxCost = Math.max(...candidates.map((c) => c.cost_per_1k_usd), 0.0001);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Model comparison</h1>
        <span className="text-xs text-slate-500">
          frontier vs fine-tuned specialist on held-out eval set
        </span>
      </header>

      {!latest && (
        <p className="rounded-lg border border-edge bg-panel/70 p-8 text-center text-sm text-slate-500">
          No benchmarks yet — run the Phase 5 pipeline.
        </p>
      )}

      {latest && frontier && specialist && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {[specialist, frontier].map((c) => (
              <div
                key={c.name}
                className={`rounded-lg border p-4 ${
                  latest.winner === c.name
                    ? "border-accent/60 bg-accent/5"
                    : "border-edge bg-panel/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-sm font-semibold text-slate-100">{c.name}</h2>
                  {latest.winner === c.name && (
                    <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                      winner
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  <Metric label="Accuracy (held-out)" value={`${(c.accuracy * 100).toFixed(1)}%`}>
                    <Bar pct={c.accuracy * 100} color={c.kind === "specialist" ? "bg-accent" : "bg-amber-400"} />
                  </Metric>
                  <Metric label="Latency p95" value={`${c.p95_ms} ms${c.measured_latency ? "" : " *"}`}>
                    <Bar
                      pct={Math.min(100, (c.p95_ms / Math.max(frontier.p95_ms, specialist.p95_ms)) * 100)}
                      color={c.kind === "specialist" ? "bg-accent" : "bg-amber-400"}
                    />
                  </Metric>
                  <Metric label="Cost per 1k requests" value={`$${c.cost_per_1k_usd.toFixed(4)}${c.measured_latency ? "" : " *"}`}>
                    <Bar pct={(c.cost_per_1k_usd / maxCost) * 100} color={c.kind === "specialist" ? "bg-accent" : "bg-amber-400"} />
                  </Metric>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
                    per-intent accuracy ({c.total} examples)
                  </summary>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 text-[11px] text-slate-400">
                    {Object.entries(c.per_intent).map(([intent, acc]) => (
                      <span key={intent} className="flex justify-between font-mono">
                        <span>{intent}</span>
                        <span>{(acc * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-edge bg-panel/70">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2">Candidate</th>
                  <th className="px-4 py-2">Accuracy</th>
                  <th className="px-4 py-2">p50</th>
                  <th className="px-4 py-2">p95</th>
                  <th className="px-4 py-2">$/1k reqs</th>
                  <th className="px-4 py-2">Measured</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.name} className="border-t border-edge/60 text-slate-300">
                    <td className="px-4 py-2 font-mono text-xs">{c.name}</td>
                    <td className="px-4 py-2">{(c.accuracy * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2">{c.p50_ms} ms</td>
                    <td className="px-4 py-2">{c.p95_ms} ms</td>
                    <td className="px-4 py-2">${c.cost_per_1k_usd.toFixed(4)}</td>
                    <td className="px-4 py-2">{c.measured_latency ? "yes" : "reference *"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {latest.notes && (
            <p className="rounded-lg border border-edge bg-panel/50 p-3 text-[11px] leading-4 text-slate-500">
              * {latest.notes}
            </p>
          )}
          <p className="text-xs text-slate-500">
            Dataset size: {Number(latest.dataset_size)} held-out examples · benchmark {latest.id}
          </p>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="text-sm font-semibold text-slate-200">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">{children}</div>
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      className={`h-full rounded-full ${color}`}
      style={{ width: `${Math.max(2, Math.min(pct, 100))}%` }}
    />
  );
}
