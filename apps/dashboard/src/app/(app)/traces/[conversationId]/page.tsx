import Link from "next/link";
import { chQueryParams } from "@/lib/ch";
import { Icon } from "@/components/icon";

export const dynamic = "force-dynamic";

interface EventRow {
  id: string;
  trace_id: string;
  name: string;
  kind: string;
  status: string;
  error_message: string | null;
  attributes: string;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  transcript_ref: string | null;
  pii_redactions: Array<{ field: string; type: string; action: string; count: number }>;
  zero_pii_mode: boolean;
  timestamp: string;
}

const KIND_LABEL: Record<string, string> = {
  agent: "agent",
  llm: "llm",
  tool: "tool",
  retrieval: "retrieval",
  checkpoint: "checkpoint",
  session: "session",
};

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const id = decodeURIComponent(conversationId);

  const events = await chQueryParams<EventRow>(
    "SELECT * FROM events WHERE conversation_id = {cid:String} ORDER BY timestamp ASC",
    { cid: id }
  );

  const minT = events.length > 0 ? new Date(events[0]!.timestamp).getTime() : 0;
  const maxT = events.length > 0 ? new Date(events[events.length - 1]!.timestamp).getTime() : 1;
  const span = Math.max(maxT - minT, 1);
  const failed = events.filter((e) => e.status === "error").length;

  return (
    <div className="px-6 pt-5">
      <Link href="/traces" className="text-[12px] text-gray-500 hover:text-gray-800">
        ← Conversations
      </Link>
      <div className="mt-1 flex items-baseline gap-3">
        <h1 className="font-mono text-[15px] font-semibold text-gray-900">{id}</h1>
        <span className="text-[12px] text-gray-400">
          {events.length} events · {failed} failed
        </span>
      </div>

      <table className="mt-4 w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-gray-500">
            <th className="w-8 border-b border-gray-200 py-2"></th>
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Step</th>
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Kind</th>
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Status</th>
            <th className="border-b border-gray-200 py-2 pr-4 text-right font-normal">Latency</th>
            <th className="border-b border-gray-200 py-2 font-normal">PII redactions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, idx) => {
            const t = new Date(e.timestamp).getTime();
            const offsetPct = Math.min(((t - minT) / span) * 100, 97);
            let attrsPreview = "";
            try {
              attrsPreview = JSON.stringify(JSON.parse(e.attributes), null, 1);
            } catch {
              attrsPreview = e.attributes;
            }
            const piiCount = (e.pii_redactions ?? []).reduce((a, r) => a + Number(r.count), 0);
            return (
              <tr key={e.id} className="align-top hover:bg-gray-50">
                <td className="border-b border-gray-100 py-2.5">
                  <span
                    className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent"
                    style={{ marginLeft: `${offsetPct}%` }}
                    title={`t+${t - minT}ms`}
                  />
                </td>
                <td className="border-b border-gray-100 py-2.5 pr-4">
                  <span className="font-medium text-gray-900">{e.name}</span>
                  {e.error_message && (
                    <span className="mt-0.5 block max-w-md truncate font-mono text-[11px] text-red-600">
                      {e.error_message}
                    </span>
                  )}
                  {attrsPreview !== "{}" && (
                    <details className="mt-0.5">
                      <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600">
                        attributes (redacted)
                      </summary>
                      <pre className="mt-1 max-h-48 max-w-xl overflow-auto rounded-md border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] leading-4 text-gray-600">
                        {attrsPreview}
                      </pre>
                    </details>
                  )}
                  {e.transcript_ref && (
                    <span className="mt-0.5 block font-mono text-[10px] text-gray-400">
                      s3://{e.transcript_ref}
                    </span>
                  )}
                </td>
                <td className="border-b border-gray-100 py-2.5 pr-4 text-gray-600">
                  {KIND_LABEL[e.kind] ?? e.kind}
                  {idx === 0 && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-400">root</span>
                  )}
                </td>
                <td className="border-b border-gray-100 py-2.5 pr-4">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      e.status === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {e.status === "error" ? "FAIL" : "PASS"}
                  </span>
                </td>
                <td className="border-b border-gray-100 py-2.5 pr-4 text-right tabular-nums text-gray-600">
                  {e.latency_ms != null ? `${Math.round(Number(e.latency_ms))} ms` : "—"}
                  {(e.tokens_in != null || e.tokens_out != null) && (
                    <span className="block text-[11px] text-gray-400">
                      {Number(e.tokens_in ?? 0)}→{Number(e.tokens_out ?? 0)} tok
                    </span>
                  )}
                </td>
                <td className="border-b border-gray-100 py-2.5">
                  {piiCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-accent">
                      <Icon name="shield" className="h-3 w-3" />
                      {piiCount} redacted
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                  {e.zero_pii_mode && (
                    <span className="ml-1 text-[10px] text-gray-400">zero-pii</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {events.length === 0 && (
        <p className="mt-6 rounded-lg border border-gray-200 p-8 text-center text-[13px] text-gray-400">
          No events for this conversation.
        </p>
      )}
    </div>
  );
}
