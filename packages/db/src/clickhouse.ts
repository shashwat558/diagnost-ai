import { createClient, type ClickHouseClient } from "@clickhouse/client";
import type { EventEnvelope } from "@diagnost/core";

export function createClickhouse(opts: {
  url: string;
  username: string;
  password: string;
  database: string;
}): ClickHouseClient {
  return createClient(opts);
}

export interface ChEventRow {
  id: string;
  workspace_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  conversation_id: string;
  session_id: string | null;
  name: string;
  kind: string;
  status: string;
  error_message: string | null;
  attributes: string;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  transcript_ref: string | null;
  pii_redactions: Array<{ field: string; type: string; action: string; count: number }>;
  zero_pii_mode: boolean;
  redactor_version: string;
  timestamp: string;
}

/** Map an envelope to the flat row shape expected by the events table. */
export function envelopeToRow(e: EventEnvelope): ChEventRow {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    trace_id: e.traceId,
    span_id: e.spanId,
    parent_span_id: e.parentSpanId ?? null,
    conversation_id: e.conversationId,
    session_id: e.sessionId ?? null,
    name: e.name,
    kind: e.kind,
    status: e.status,
    error_message: e.errorMessage ?? null,
    attributes: JSON.stringify(e.attributes),
    // UInt64 column — round defensively; floats break JSONEachRow parsing
    latency_ms: e.metrics.latencyMs != null ? Math.round(e.metrics.latencyMs) : null,
    tokens_in: e.metrics.tokensIn ?? null,
    tokens_out: e.metrics.tokensOut ?? null,
    cost_usd: e.metrics.costUsd ?? null,
    transcript_ref: e.transcriptRef ?? null,
    pii_redactions: e.piiAudit.redactions.map((r) => ({
      field: r.field,
      type: r.type,
      action: r.action,
      count: r.count,
    })),
    zero_pii_mode: e.piiAudit.zeroPiiMode,
    redactor_version: e.piiAudit.redactorVersion,
    // DateTime64 JSONEachRow wants "YYYY-MM-DD HH:MM:SS.mmm" (UTC per column tz)
    timestamp: new Date(e.timestampMs).toISOString().replace("T", " ").replace("Z", ""),
  };
}

export async function insertEvents(
  ch: ClickHouseClient,
  database: string,
  events: EventEnvelope[]
): Promise<void> {
  if (events.length === 0) return;
  await ch.insert({
    table: `${database}.events`,
    values: events.map(envelopeToRow),
    format: "JSONEachRow",
  });
}
