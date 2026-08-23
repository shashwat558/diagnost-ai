import { chQueryParams } from "@/lib/ch";

export const dynamic = "force-dynamic";

interface EventRow {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
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
  redactor_version: string;
  timestamp: string;
}

const KIND_COLOR: Record<string, string> = {
  agent: "bg-violet-500/15 text-violet-300",
  llm: "bg-sky-500/15 text-sky-300",
  tool: "bg-emerald-500/15 text-emerald-300",
  retrieval: "bg-amber-500/15 text-amber-300",
  checkpoint: "bg-pink-500/15 text-pink-300",
  session: "bg-slate-500/15 text-slate-300",
};

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${className}`}>
      {children}
    </span>
  );
}

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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-mono text-lg font-semibold text-slate-100">{id}</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {events.length} events · session reconstructed in order with pass/fail markers
        </p>
      </header>

      <div className="space-y-2">
        {events.map((e) => {
          const t = new Date(e.timestamp).getTime();
          const offsetPct = ((t - minT) / span) * 100;
          let attrsPreview = "";
          try {
            attrsPreview = JSON.stringify(JSON.parse(e.attributes), null, 1);
          } catch {
            attrsPreview = e.attributes;
          }
          return (
            <div key={e.id} className="rounded-lg border border-edge bg-panel/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* waterfall position marker */}
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                  style={{ marginLeft: `${Math.min(offsetPct, 97)}%` }}
                  title={`t+${t - minT}ms`}
                />
                <Badge className={KIND_COLOR[e.kind] ?? KIND_COLOR["session"]!}>{e.kind}</Badge>
                <span className="font-mono text-sm text-slate-100">{e.name}</span>
                <Badge
                  className={
                    e.status === "error" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
                  }
                >
                  {e.status === "error" ? "FAIL" : "PASS"}
                </Badge>
                {e.latency_ms != null && (
                  <span className="text-xs text-slate-400">{Math.round(Number(e.latency_ms))} ms</span>
                )}
                {(e.tokens_in != null || e.tokens_out != null) && (
                  <span className="text-xs text-slate-500">
                    tokens {Number(e.tokens_in ?? 0)}→{Number(e.tokens_out ?? 0)}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-slate-600">
                  {String(e.timestamp).replace("T", " ").slice(0, 23)}
                </span>
              </div>

              {e.error_message && (
                <p className="mt-2 rounded bg-red-500/10 px-2 py-1 font-mono text-xs text-red-300">
                  {e.error_message}
                </p>
              )}

              {e.pii_redactions?.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-teal-300/80">
                    PII audit ({e.pii_redactions.reduce((a, r) => a + Number(r.count), 0)}):
                  </span>
                  {e.pii_redactions.map((r, i) => (
                    <Badge key={i} className="bg-teal-500/10 text-teal-300">
                      {r.type}·{r.action}×{r.count}
                    </Badge>
                  ))}
                </div>
              )}

              {attrsPreview !== "{}" && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
                    attributes (redacted)
                  </summary>
                  <pre className="mt-1 max-h-56 overflow-auto rounded bg-ink p-2 font-mono text-[11px] leading-4 text-slate-400">
                    {attrsPreview}
                  </pre>
                </details>
              )}

              {e.transcript_ref && (
                <p className="mt-1 text-[10px] text-slate-600">transcript: s3://{e.transcript_ref}</p>
              )}
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <p className="rounded-lg border border-edge bg-panel/70 p-8 text-center text-sm text-slate-500">
          No events for this conversation.
        </p>
      )}
    </div>
  );
}
