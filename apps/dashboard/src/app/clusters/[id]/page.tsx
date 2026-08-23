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
  top_terms: string[];
}

interface MemberRow {
  conversation_id: string;
  has_error: boolean;
}

export default async function ClusterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [cluster] = await pgQuery<ClusterRow>(
    `SELECT id, intent, summary, size, error_rate, frustration, sentiment, top_terms
     FROM clusters WHERE id = $1`,
    [id]
  );
  const members = await pgQuery<MemberRow>(
    `SELECT conversation_id, has_error FROM cluster_members WHERE cluster_id = $1
     ORDER BY has_error DESC, conversation_id LIMIT 200`,
    [id]
  );

  if (!cluster) {
    return <p className="text-slate-500">Cluster not found.</p>;
  }

  return (
    <div className="space-y-4">
      <header>
        <Link href="/clusters" className="text-xs text-accent hover:underline">
          ← all patterns
        </Link>
        <h1 className="mt-1 text-xl font-semibold capitalize">{cluster.intent.replace(/_/g, " ")}</h1>
        <p className="mt-0.5 text-sm text-slate-400">{cluster.summary}</p>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span>{Number(cluster.size)} conversations</span>
          <span>error rate {(Number(cluster.error_rate) * 100).toFixed(0)}%</span>
          <span>frustration {(Number(cluster.frustration) * 100).toFixed(0)}%</span>
          <span>sentiment {Number(cluster.sentiment).toFixed(2)}</span>
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-edge bg-panel/70">
        <h2 className="border-b border-edge px-4 py-2 text-xs uppercase tracking-wider text-slate-500">
          Source conversations (linked evidence)
        </h2>
        <ul className="divide-y divide-edge/60">
          {members.map((m) => (
            <li key={m.conversation_id} className="flex items-center justify-between px-4 py-2">
              <Link
                href={`/traces/${encodeURIComponent(m.conversation_id)}`}
                className="font-mono text-xs text-accent hover:underline"
              >
                {m.conversation_id}
              </Link>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  m.has_error ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {m.has_error ? "FAIL" : "PASS"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
