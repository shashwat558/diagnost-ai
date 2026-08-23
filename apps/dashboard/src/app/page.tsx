import Link from "next/link";
import { chQuery } from "@/lib/ch";
import { LatencyChart, ToolChart, VolumeChart } from "@/components/charts";

export const dynamic = "force-dynamic";

interface StatRow {
  total: string;
  errors: string;
  p50: number | null;
  p95: number | null;
  conversations: string;
}
interface BucketRow {
  bucket: string;
  ok: string;
  error: string;
}
interface LatencyBucketRow {
  bucket: string;
  p50: number | null;
  p95: number | null;
}
interface ToolRow {
  name: string;
  calls: string;
  errors: string;
  avg_ms: number | null;
}

function fmtMs(v: number | null): string {
  return v == null ? "—" : `${Math.round(v)} ms`;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel/70 p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default async function OverviewPage() {
  const [stats] = await chQuery<StatRow>(`
    SELECT
      count() AS total,
      countIf(status = 'error') AS errors,
      quantile(0.5)(latency_ms) AS p50,
      quantile(0.95)(latency_ms) AS p95,
      uniqExact(conversation_id) AS conversations
    FROM events
    WHERE timestamp > now() - INTERVAL 24 HOUR
  `);

  const volume = await chQuery<BucketRow>(`
    SELECT
      formatDateTime(toStartOfMinute(timestamp), '%H:%M') AS bucket,
      countIf(status = 'ok') AS ok,
      countIf(status = 'error') AS error
    FROM events
    WHERE timestamp > now() - INTERVAL 6 HOUR
    GROUP BY bucket ORDER BY bucket
  `);

  const latency = await chQuery<LatencyBucketRow>(`
    SELECT
      formatDateTime(toStartOfInterval(timestamp, INTERVAL 10 MINUTE), '%H:%M') AS bucket,
      quantile(0.5)(latency_ms) AS p50,
      quantile(0.95)(latency_ms) AS p95
    FROM events
    WHERE timestamp > now() - INTERVAL 6 HOUR AND latency_ms IS NOT NULL
    GROUP BY bucket ORDER BY bucket
  `);

  const tools = await chQuery<ToolRow>(`
    SELECT
      name,
      count() AS calls,
      countIf(status = 'error') AS errors,
      avg(latency_ms) AS avg_ms
    FROM events
    WHERE kind IN ('tool', 'llm', 'retrieval') AND timestamp > now() - INTERVAL 24 HOUR
    GROUP BY name ORDER BY calls DESC LIMIT 8
  `);

  const errRate = stats && Number(stats.total) > 0 ? ((Number(stats.errors) / Number(stats.total)) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Overview — Dev Workspace</h1>
        <span className="text-xs text-slate-500">last 24h · live from ClickHouse</span>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card label="Events" value={stats ? Number(stats.total).toLocaleString() : "—"} />
        <Card label="Error rate" value={`${errRate}%`} />
        <Card label="p50 latency" value={fmtMs(stats?.p50 ?? null)} />
        <Card label="p95 latency" value={fmtMs(stats?.p95 ?? null)} />
        <Card label="Conversations" value={stats ? Number(stats.conversations).toLocaleString() : "—"} />
      </div>

      <section className="rounded-lg border border-edge bg-panel/70 p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-300">Event volume (ok / error)</h2>
        <VolumeChart data={volume.map((r) => ({ bucket: r.bucket, ok: Number(r.ok), error: Number(r.error) }))} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-edge bg-panel/70 p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-300">Latency timeline</h2>
          <LatencyChart data={latency.map((r) => ({ bucket: r.bucket, p50: Number(r.p50 ?? 0), p95: Number(r.p95 ?? 0) }))} />
        </section>
        <section className="rounded-lg border border-edge bg-panel/70 p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-300">Per-tool breakdown</h2>
          <ToolChart data={tools.map((r) => ({ name: r.name, calls: Number(r.calls), errors: Number(r.errors) }))} />
        </section>
      </div>

      <section className="rounded-lg border border-edge bg-panel/70">
        <h2 className="border-b border-edge px-4 py-3 text-sm font-medium text-slate-300">
          Tool detail
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Calls</th>
              <th className="px-4 py-2">Errors</th>
              <th className="px-4 py-2">Avg latency</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.name} className="border-t border-edge/60 text-slate-300">
                <td className="px-4 py-2 font-mono text-xs">{t.name}</td>
                <td className="px-4 py-2">{Number(t.calls).toLocaleString()}</td>
                <td className={`px-4 py-2 ${Number(t.errors) > 0 ? "text-red-400" : ""}`}>{t.errors}</td>
                <td className="px-4 py-2">{fmtMs(t.avg_ms)}</td>
              </tr>
            ))}
            {tools.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No tool events yet — run the sample agent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <Link href="/traces" className="inline-block text-sm text-accent hover:underline">
        Browse conversations →
      </Link>
    </div>
  );
}
