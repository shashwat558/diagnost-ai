import { chQuery } from "@/lib/ch";
import { getIntentRows } from "@/lib/intents";
import { getSession } from "@/lib/session";
import { IntentsTable } from "@/components/intents-table";
import { Sparkline } from "@/components/sparkline";

export const dynamic = "force-dynamic";

export default async function ClustersPage() {
  const session = await getSession();
  const rows = await getIntentRows(session?.workspaceId ?? "ws_dev");

  // matches-over-time line for the header card: total clustered conversations per day
  const daily = await chQuery<{ d: string; n: number }>(`
    SELECT toDate(timestamp) AS d, uniqExact(conversation_id) AS n
    FROM events
    WHERE timestamp > now() - INTERVAL 7 DAY
    GROUP BY d
  `);

  const days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    const hit = daily.find((r) => String(r.d).slice(0, 10) === key);
    days.push(Number(hit?.n ?? 0));
  }
  const total = rows.reduce((a, r) => a + r.size, 0);

  return (
    <div className="pb-8 bg-canvas text-ink min-h-screen font-sans">
      <div className="px-6 pt-6">
        <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Failure &amp; Intent Clusters</h1>
            <p className="font-tech text-xs text-ink-muted mt-1">Automatic grouping of execution failure patterns</p>
          </div>
          <span className="font-tech text-xs text-brand bg-brand/10 px-3 py-1 border border-brand/20">
            {rows.length} CLUSTERS IDENTIFIED
          </span>
        </div>

        <div className="rounded-none border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="font-display text-base font-semibold text-ink">
              {total.toLocaleString()} conversations across {rows.length} intents
            </h2>
            <span className="font-tech text-xs text-ink-muted">last 7 days volume</span>
          </div>
          <div className="mt-4">
            <Sparkline points={days} width={1120} height={72} />
          </div>
        </div>
      </div>

      <div className="mt-6 px-6">
        <div className="rounded-none border border-line bg-surface p-5">
          <IntentsTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
