import Link from "next/link";
import { pgQuery } from "@/lib/pg";

export const dynamic = "force-dynamic";

interface ClusterRow {
  id: string;
  intent: string;
  summary: string;
  size: number;
  error_rate: number;
  frustration: number;
  sentiment: number;
  est_failures: number;
  top_terms: string[];
  created_at: string;
}

interface AlertRow {
  id: string;
  cluster_id: string | null;
  type: string;
  severity: string;
  message: string;
  created_at: string;
}

const INTENT_COLOR: Record<string, string> = {
  date_format_error: "bg-amber-500/15 text-amber-300",
  tool_timeout: "bg-sky-500/15 text-sky-300",
  billing_dispute: "bg-violet-500/15 text-violet-300",
  order_status: "bg-emerald-500/15 text-emerald-300",
  account_access: "bg-pink-500/15 text-pink-300",
  general_inquiry: "bg-slate-500/15 text-slate-300",
};

export default async function ClustersPage() {
  const clusters = await pgQuery<ClusterRow>(
    `SELECT id, intent, summary, size, error_rate, frustration, sentiment,
            round(size * error_rate)::int AS est_failures, top_terms, created_at
     FROM clusters ORDER BY est_failures DESC LIMIT 30`
  );
  const alerts = await pgQuery<AlertRow>(
    `SELECT a.id, a.cluster_id, a.type, a.severity, a.message, a.created_at
     FROM alerts a ORDER BY a.created_at DESC LIMIT 10`
  );

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Failure patterns & clusters</h1>
        <span className="text-xs text-slate-500">ranked by failure impact · HDBSCAN + LLM judge</span>
      </header>

      {alerts.length > 0 && (
        <section className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                a.severity === "critical"
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-amber-500/40 bg-amber-500/10"
              }`}
            >
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  a.severity === "critical" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-200"
                }`}
              >
                {a.severity} · drift
              </span>
              {a.cluster_id && (
                <Link href={`/clusters/${a.cluster_id}`} className="text-xs font-medium text-accent hover:underline">
                  {a.cluster_id}
                </Link>
              )}
              <span className="text-sm text-slate-200">{a.message}</span>
              <span className="ml-auto text-[10px] text-slate-500">
                {String(a.created_at).replace("T", " ").slice(0, 19)}
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="overflow-hidden rounded-lg border border-edge bg-panel/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2">Pattern</th>
              <th className="px-4 py-2">Members</th>
              <th className="px-4 py-2">Error rate</th>
              <th className="px-4 py-2">Est. failures</th>
              <th className="px-4 py-2">Frustration</th>
              <th className="px-4 py-2">Top signals</th>
              <th className="px-4 py-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((c) => (
              <tr key={c.id} className="border-t border-edge/60 align-top hover:bg-edge/30">
                <td className="px-4 py-2">
                  <Link href={`/clusters/${c.id}`} className="block">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${INTENT_COLOR[c.intent] ?? INTENT_COLOR["general_inquiry"]}`}>
                      {c.intent.replace(/_/g, " ")}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-600">{c.id}</span>
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-300">{Number(c.size)}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-edge">
                      <div
                        className={`h-full ${Number(c.error_rate) > 0.4 ? "bg-red-400" : "bg-accent"}`}
                        style={{ width: `${Math.min(Number(c.error_rate) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{(Number(c.error_rate) * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-4 py-2 font-semibold text-slate-100">~{Number(c.est_failures)}</td>
                <td className="px-4 py-2 text-xs text-slate-400">{(Number(c.frustration) * 100).toFixed(0)}%</td>
                <td className="px-4 py-2">
                  <div className="flex max-w-[180px] flex-wrap gap-1">
                    {(c.top_terms ?? []).slice(0, 4).map((t) => (
                      <span key={t} className="rounded bg-edge/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="max-w-[260px] px-4 py-2 text-xs leading-4 text-slate-400">{c.summary}</td>
              </tr>
            ))}
            {clusters.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No clusters yet — run the analysis worker.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
