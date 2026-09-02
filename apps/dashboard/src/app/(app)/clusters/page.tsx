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
    <div className="pb-0">
      <div className="px-6 pt-5">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-[15px] font-semibold text-gray-900">
              {total} conversations across {rows.length} intents
            </h1>
            <span className="text-[12px] text-gray-400">last 7 days</span>
          </div>
          <div className="mt-2">
            <Sparkline points={days} width={1120} height={72} />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <IntentsTable rows={rows} />
      </div>
    </div>
  );
}
