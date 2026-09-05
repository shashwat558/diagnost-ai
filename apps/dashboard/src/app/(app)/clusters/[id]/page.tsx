import Link from "next/link";
import { pgQuery } from "@/lib/pg";
import { HelpTip } from "@/components/ui/help-tip";
import { CopyButton } from "@/components/ui/copy-button";

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
    return <p className="px-6 pt-5 text-[13px] text-gray-500">Intent not found — it may have been removed or the link is wrong.</p>;
  }

  const frustration = Number(cluster.frustration);
  const sentiment = Number(cluster.sentiment);
  const sentimentLabel =
    sentiment >= 4 ? "Positive" : sentiment >= 2.5 ? "Mixed" : sentiment > 0 ? "Negative" : "—";

  return (
    <div className="px-6 pt-5">
      <Link href="/clusters" className="text-[12px] text-gray-500 hover:text-gray-800">
        ← Intents
      </Link>
      <div className="mt-1 flex items-center gap-2">
        <h1 className="text-[15px] font-semibold capitalize text-gray-900">
          {cluster.intent.replace(/_/g, " ")}
        </h1>
        {frustration >= 0.5 && (
          <span
            className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent"
            title="Over half of rated conversations here got low scores — adding an instruction gives the auto-improver something to refine."
          >
            Needs instruction
          </span>
        )}
      </div>
      <p className="mt-0.5 max-w-3xl text-[13px] text-gray-500">{cluster.summary}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-gray-500">
        <span>{Number(cluster.size)} conversations</span>
        <span>
          {(Number(cluster.error_rate) * 100).toFixed(0)}% failed
          <HelpTip text="Share of conversations in this intent where something went wrong." />
        </span>
        <span>
          {(frustration * 100).toFixed(0)}% frustrated
          <HelpTip text="Share of rated conversations that got a low score from the user." />
        </span>
        <span>
          Mood: {sentimentLabel}
          <HelpTip text="Average user mood across this intent, from assistant and user messages." />
        </span>
        <span className="flex gap-1">
          <span className="text-gray-400">Common words:</span>
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
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Example conversation</th>
            <th className="border-b border-gray-200 py-2 font-normal">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 && (
            <tr>
              <td colSpan={2} className="py-8 text-center text-gray-400">
                No examples yet — they appear after the next analysis run.
              </td>
            </tr>
          )}
          {members.map((m) => (
            <tr key={m.conversation_id} className="hover:bg-gray-50">
              <td className="border-b border-gray-100 py-2.5 pr-4">
                <Link
                  href={`/traces/${encodeURIComponent(m.conversation_id)}`}
                  className="font-mono text-[12px] text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-500"
                  title={m.conversation_id}
                >
                  …{m.conversation_id.slice(-12)}
                </Link>
                <CopyButton text={m.conversation_id} />
              </td>
              <td className="border-b border-gray-100 py-2.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    m.has_error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                  }`}
                  title={m.has_error ? "Something failed in this conversation — open it to see what broke." : "This conversation completed without errors."}
                >
                  {m.has_error ? "Failed" : "Passed"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
