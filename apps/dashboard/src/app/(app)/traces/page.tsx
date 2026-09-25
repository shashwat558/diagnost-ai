import Link from "next/link";
import { chQuery } from "@/lib/ch";
import { HelpTip } from "@/components/ui/help-tip";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusChip } from "@/components/landing-bits";

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
    <div className="px-6 pt-6 bg-black min-h-screen text-white">
      <div className="flex items-baseline justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Conversations &amp; Traces</h1>
          <p className="font-tech text-xs text-[#999999] mt-1">Inspecting 50 most recent agent sessions</p>
        </div>
        <span className="font-tech text-xs text-[#52a8ff] bg-[#52a8ff]/10 px-3 py-1 border border-[#52a8ff]/20">
          50 RECORDED SESSIONS
        </span>
      </div>

      <div className="mt-6 border border-white/10 bg-[#0a0a0a]">
        <table className="w-full text-left font-tech text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[#999999] uppercase tracking-wider bg-[#0d0d0d]">
              <th className="py-3 px-4 font-normal">Conversation ID</th>
              <th className="py-3 px-4 text-right font-normal">
                Steps
                <HelpTip text="Individual tracked actions in this conversation." />
              </th>
              <th className="py-3 px-4 font-normal">Outcome</th>
              <th className="py-3 px-4 text-right font-normal">
                PII Redact
                <HelpTip text="Sensitive fields scrubbed automatically before storage." />
              </th>
              <th className="py-3 px-4 font-normal">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {convos.map((c) => {
              const failed = Number(c.errors) > 0;
              return (
                <tr key={c.conversation_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4">
                    <Link
                      href={`/traces/${encodeURIComponent(c.conversation_id)}`}
                      className="font-mono text-xs text-white hover:text-[#52a8ff] transition-colors"
                      title={c.conversation_id}
                    >
                      …{c.conversation_id.slice(-16)}
                    </Link>
                    <CopyButton text={c.conversation_id} />
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-gray-300">
                    {Number(c.events)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusChip status={failed ? "fail" : "pass"}>
                      {failed ? `${c.errors} FAILED` : "PASSED"}
                    </StatusChip>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-[#999999]">
                    {Number(c.pii_findings) || "—"}
                  </td>
                  <td className="py-3 px-4 text-[#999999]">
                    {String(c.last_ts).replace("T", " ").slice(0, 19)}
                  </td>
                </tr>
              );
            })}
            {convos.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#999999]">
                  No conversation traces recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
