import { pgQuery } from "./pg";
import { chQuery } from "./ch";

export interface IntentRow {
  id: string;
  intent: string;
  summary: string;
  size: number;
  error_rate: number;
  frustration: number;
  top_terms: string[];
  created_at: string;
  /** daily conversation counts, oldest → newest (7 buckets) */
  daily: number[];
  deltaPct: number | null; // last day vs prior day
  lastSeen: string | null;
}

const CH_DSN = "'postgres:5432','diagnost','cluster_members','diagnost','diagnost_dev_password'";
const CH_DSN_C = "'postgres:5432','diagnost','clusters','diagnost','diagnost_dev_password'";

export async function getIntentRows(): Promise<IntentRow[]> {
  const clusters = await pgQuery<{
    id: string;
    intent: string;
    summary: string;
    size: number;
    error_rate: number;
    frustration: number;
    top_terms: string[];
    created_at: string;
  }>(
    `SELECT id, intent, summary, size, error_rate, frustration, top_terms, created_at
     FROM clusters WHERE workspace_id='ws_dev' ORDER BY size DESC`
  );
  if (clusters.length === 0) return [];

  const daily = await chQuery<{ intent: string; d: string; n: number }>(`
    SELECT any(c.intent) AS intent, toDate(e.timestamp) AS d, uniqExact(e.conversation_id) AS n
    FROM events.events e
    INNER JOIN postgresql(${CH_DSN}) m ON m.conversation_id = e.conversation_id
    INNER JOIN postgresql(${CH_DSN_C}) c ON c.id = m.cluster_id
    WHERE e.timestamp > now() - INTERVAL 7 DAY
    GROUP BY e.conversation_id, d
  `);

  const lastSeen = await chQuery<{ intent: string; last: string }>(`
    SELECT c.intent AS intent, max(e.timestamp) AS last
    FROM events.events e
    INNER JOIN postgresql(${CH_DSN}) m ON m.conversation_id = e.conversation_id
    INNER JOIN postgresql(${CH_DSN_C}) c ON c.id = m.cluster_id
    GROUP BY c.intent
  `);

  // build per-intent 7-day series
  const byIntentDaily = new Map<string, Map<string, number>>();
  for (const r of daily) {
    const m = byIntentDaily.get(r.intent) ?? new Map<string, number>();
    m.set(String(r.d).slice(0, 10), Number(r.n));
    byIntentDaily.set(r.intent, m);
  }
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
  }
  const lastSeenMap = new Map(lastSeen.map((r) => [r.intent, String(r.last)]));

  return clusters.map((c) => {
    const m = byIntentDaily.get(c.intent);
    const series = days.map((d) => (m?.get(d) ?? 0) + (m ? 0 : 0));
    // ensure clusters whose members had events before the 7d window still show size signal
    const flat = series.reduce((a, b) => a + b, 0);
    const dailyOut = flat === 0 ? [c.size] : series;
    const last = dailyOut[dailyOut.length - 1]!;
    const prev = dailyOut[dailyOut.length - 2] ?? 0;
    const deltaPct = prev === 0 ? (last > 0 ? 100 : null) : Math.round(((last - prev) / prev) * 100);
    return {
      ...c,
      size: Number(c.size),
      error_rate: Number(c.error_rate),
      frustration: Number(c.frustration),
      daily: dailyOut,
      deltaPct,
      lastSeen: lastSeenMap.get(c.intent) ?? null,
    };
  });
}
