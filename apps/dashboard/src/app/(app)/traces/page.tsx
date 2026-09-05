import Link from "next/link";
import { chQuery } from "@/lib/ch";
import { HelpTip } from "@/components/ui/help-tip";
import { CopyButton } from "@/components/ui/copy-button";

export const dynamic = "force-dynamic";

interface ConvRow {
  conversation_id: string;
  events: string;
  errors: string;
  first_ts: string;
  last_ts: string;
  pii_findings: string;
}

export default async function ConversationsPage() {
  const convos = await chQuery<ConvRow>(`
    SELECT
      conversation_id,
      count() AS events,
      countIf(status = 'error') AS errors,
      min(timestamp) AS first_ts,
      max(timestamp) AS last_ts,
      sum(length(pii_redactions)) AS pii_findings
    FROM events
    GROUP BY conversation_id
    ORDER BY last_ts DESC
    LIMIT 50
  `);

  return (
    <div className="px-6 pt-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[15px] font-semibold text-gray-900">Conversations</h1>
        <span className="text-[12px] text-gray-400">most recent 50</span>
      </div>

      <table className="mt-4 w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-gray-500">
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Conversation</th>
            <th className="border-b border-gray-200 py-2 pr-4 text-right font-normal">
              Steps
              <HelpTip text="Individual tracked actions (agent replies, tool calls, checkpoints) in this conversation." />
            </th>
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Outcome</th>
            <th className="border-b border-gray-200 py-2 pr-4 text-right font-normal">
              PII redacted
              <HelpTip text="Sensitive bits (emails, phones, cards) automatically hidden before storage. Higher is safer, not worse." />
            </th>
            <th className="border-b border-gray-200 py-2 font-normal">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {convos.map((c) => {
            const failed = Number(c.errors) > 0;
            return (
              <tr key={c.conversation_id} className="hover:bg-gray-50">
                <td className="border-b border-gray-100 py-2.5 pr-4">
                  <Link
                    href={`/traces/${encodeURIComponent(c.conversation_id)}`}
                    className="font-mono text-[12px] text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-500"
                    title={c.conversation_id}
                  >
                    …{c.conversation_id.slice(-12)}
                  </Link>
                  <CopyButton text={c.conversation_id} />
                </td>
                <td className="border-b border-gray-100 py-2.5 pr-4 text-right tabular-nums text-gray-700">
                  {Number(c.events)}
                </td>
                <td className="border-b border-gray-100 py-2.5 pr-4">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      failed ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                    }`}
                    title={failed ? "At least one step failed — open to see what broke." : "Every step completed without errors."}
                  >
                    {failed ? `${c.errors} failed` : "Passed"}
                  </span>
                </td>
                <td className="border-b border-gray-100 py-2.5 pr-4 text-right tabular-nums text-gray-600">
                  {Number(c.pii_findings) || "—"}
                </td>
                <td className="border-b border-gray-100 py-2.5 text-gray-500">
                  {String(c.last_ts).replace("T", " ").slice(0, 19)}
                </td>
              </tr>
            );
          })}
          {convos.length === 0 && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-gray-400">
                No conversations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
