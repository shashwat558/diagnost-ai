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
    return <p className="px-6 pt-5 text-[13px] text-gray-500">Cluster not found.</p>;
  }

  return (
    <div className="px-6 pt-5">
      <Link href="/clusters" className="text-[12px] text-gray-500 hover:text-gray-800">
        ← Intents
      </Link>
      <div className="mt-1 flex items-center gap-2">
        <h1 className="text-[15px] font-semibold capitalize text-gray-900">
          {cluster.intent.replace(/_/g, " ")}
        </h1>
        {Number(cluster.frustration) >= 0.5 && (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
            Suggested
          </span>
        )}
      </div>
      <p className="mt-0.5 max-w-3xl text-[13px] text-gray-500">{cluster.summary}</p>

      <div className="mt-3 flex gap-5 text-[12px] text-gray-500">
        <span>{Number(cluster.size)} conversations</span>
        <span>error rate {(Number(cluster.error_rate) * 100).toFixed(0)}%</span>
        <span>frustration {(Number(cluster.frustration) * 100).toFixed(0)}%</span>
        <span>sentiment {Number(cluster.sentiment).toFixed(2)}</span>
        <span className="flex gap-1">
          {(cluster.top_terms ?? []).slice(0, 5).map((t) => (
            <span key={t} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600">
              {t}
            </span>
          ))}
        </span>
      </div>

      <table className="mt-4 w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-gray-500">
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Source conversation</th>
            <th className="border-b border-gray-200 py-2 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.conversation_id} className="hover:bg-gray-50">
              <td className="border-b border-gray-100 py-2.5 pr-4">
                <Link
                  href={`/traces/${encodeURIComponent(m.conversation_id)}`}
                  className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-500"
                >
                  {m.conversation_id}
                </Link>
              </td>
              <td className="border-b border-gray-100 py-2.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    m.has_error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {m.has_error ? "FAIL" : "PASS"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
