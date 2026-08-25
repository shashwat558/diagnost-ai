import Link from "next/link";
import { chQuery } from "@/lib/ch";
import { LatencyChart, VolumeChart } from "@/components/charts";
import { Icon } from "@/components/icon";

export const dynamic = "force-dynamic";

interface StatRow {
  total: string;
  errors: string;
  p50: number | null;
  p95: number | null;
  conversations: string;
}
interface BucketRow { bucket: string; ok: string; error: string }
interface LatencyBucketRow { bucket: string; p50: number | null; p95: number | null }
interface TickRow { status: string }

function fmtMs(v: number | null) {
  return v == null ? "—" : `${Math.round(v)} ms`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3.5">
      <div className="text-[12px] text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export default async function HomePage() {
  const [stats] = await chQuery<StatRow>(`
    SELECT count() AS total,
           countIf(status = 'error') AS errors,
           quantile(0.5)(latency_ms) AS p50,
           quantile(0.95)(latency_ms) AS p95,
           uniqExact(conversation_id) AS conversations
    FROM events WHERE timestamp > now() - INTERVAL 24 HOUR
  `);
  const volume = await chQuery<BucketRow>(`
    SELECT formatDateTime(toStartOfMinute(timestamp), '%H:%M') AS bucket,
           countIf(status='ok') AS ok, countIf(status='error') AS error
    FROM events WHERE timestamp > now() - INTERVAL 6 HOUR
    GROUP BY bucket ORDER BY bucket
  `);
  const latency = await chQuery<LatencyBucketRow>(`
    SELECT formatDateTime(toStartOfInterval(timestamp, INTERVAL 10 MINUTE), '%H:%M') AS bucket,
           quantile(0.5)(latency_ms) AS p50, quantile(0.95)(latency_ms) AS p95
    FROM events WHERE timestamp > now() - INTERVAL 6 HOUR AND latency_ms IS NOT NULL
    GROUP BY bucket ORDER BY bucket
  `);
  const ticks = await chQuery<TickRow>(
    "SELECT status FROM events ORDER BY timestamp DESC LIMIT 60"
  );

  const errRate =
    stats && Number(stats.total) > 0
      ? ((Number(stats.errors) / Number(stats.total)) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 px-6 pt-5">
        {/* stat strip */}
        <div className="grid grid-cols-5 divide-x divide-gray-200 rounded-lg border border-gray-200">
          <Stat label="Events (24h)" value={stats ? Number(stats.total).toLocaleString() : "—"} />
          <Stat label="Error rate" value={`${errRate}%`} />
          <Stat label="p50 latency" value={fmtMs(stats?.p50 ?? null)} />
          <Stat label="p95 latency" value={fmtMs(stats?.p95 ?? null)} />
          <Stat label="Conversations" value={stats ? Number(stats.conversations).toLocaleString() : "—"} />
        </div>

        {/* volume chart card */}
        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-gray-900">Event volume</h2>
            <span className="text-[12px] text-gray-400">ok vs error · last 6h</span>
          </div>
          <div className="mt-2">
            <VolumeChart data={volume.map((r) => ({ bucket: r.bucket, ok: Number(r.ok), error: Number(r.error) }))} />
          </div>
        </div>

        {/* latency + tools */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-[15px] font-semibold text-gray-900">Latency</h2>
            <div className="mt-2">
              <LatencyChart data={latency.map((r) => ({ bucket: r.bucket, p50: Number(r.p50 ?? 0), p95: Number(r.p95 ?? 0) }))} />
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-gray-900">Top tools</h2>
              <Link href="/clusters" className="text-[12px] text-accent hover:underline">
                View intents →
              </Link>
            </div>
            <ToolTable />
          </div>
        </div>
      </div>

      {/* live events footer strip */}
      <footer className="sticky bottom-0 mt-6 border-t border-gray-200 bg-white">
        <div className="flex items-center gap-4 px-6 py-2.5">
          <span className="text-[12px] font-medium text-gray-600">Live events</span>
          <div className="flex flex-1 items-center gap-[3px] overflow-hidden">
            {ticks.map((t, i) => (
              <span
                key={i}
                className={`inline-block h-2.5 w-[3px] rounded-sm ${
                  t.status === "error" ? "bg-red-500" : "bg-gray-200"
                }`}
              />
            ))}
            {ticks.length === 0 && <span className="text-[12px] text-gray-400">no events yet</span>}
          </div>
          <Link href="/traces" className="flex items-center gap-1 text-[12px] text-gray-600 hover:text-gray-900">
            View all <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>
    </div>
  );
}

async function ToolTable() {
  const tools = await chQuery<{ name: string; calls: string; errors: string; avg_ms: number | null }>(`
    SELECT name, count() AS calls, countIf(status='error') AS errors, avg(latency_ms) AS avg_ms
    FROM events WHERE kind IN ('tool','llm','retrieval') AND timestamp > now() - INTERVAL 24 HOUR
    GROUP BY name ORDER BY calls DESC LIMIT 6
  `);
  if (tools.length === 0) {
    return <p className="py-8 text-center text-[13px] text-gray-400">No tool calls yet.</p>;
  }
  return (
    <table className="mt-2 w-full text-[13px]">
      <tbody>
        {tools.map((t) => (
          <tr key={t.name} className="border-b border-gray-100 last:border-0">
            <td className="py-2 font-mono text-[12px] text-gray-700">{t.name}</td>
            <td className="py-2 text-right tabular-nums text-gray-600">{Number(t.calls)}</td>
            <td className={`py-2 pl-4 text-right tabular-nums ${Number(t.errors) > 0 ? "text-red-600" : "text-gray-400"}`}>
              {Number(t.errors) > 0 ? `${t.errors} err` : "—"}
            </td>
            <td className="py-2 pl-4 text-right tabular-nums text-gray-600">{fmtMs(t.avg_ms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
