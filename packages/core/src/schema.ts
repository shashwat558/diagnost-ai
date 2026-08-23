import { z } from "zod";

/**
 * Canonical event envelope for Diagnost AI.
 * OTel-native: trace/span/parent ids mirror W3C trace context so any existing
 * OpenTelemetry pipeline (LangChain, Vercel AI SDK, LlamaIndex, MCP) maps 1:1.
 */

export const EVENT_SCHEMA_VERSION = 1 as const;

const Uuid = z.string().uuid();
const TraceId = z.string().regex(/^[0-9a-f]{32}$/i);
const SpanId = z.string().regex(/^[0-9a-f]{16}$/i);

export const EventKind = z.enum(["agent", "llm", "tool", "retrieval", "checkpoint", "session"]);
export type EventKind = z.infer<typeof EventKind>;

export const EventStatus = z.enum(["ok", "error"]);
export type EventStatus = z.infer<typeof EventStatus>;

export const RedactionAction = z.enum(["hash", "strip"]);
export type RedactionAction = z.infer<typeof RedactionAction>;

export const DetectorType = z.enum(["email", "phone", "ssn", "credit_card", "named_entity", "custom"]);
export type DetectorType = z.infer<typeof DetectorType>;

export const PiiRedaction = z.object({
  /** dotted path or detector name that fired, e.g. "attributes.user.email" */
  field: z.string().min(1),
  /** detector category */
  type: DetectorType,
  action: RedactionAction,
  /** how many occurrences were redacted in this field */
  count: z.number().int().nonnegative(),
});

export const PiiAudit = z.object({
  redactions: z.array(PiiRedaction).max(1000),
  zeroPiiMode: z.boolean(),
  /** sdk version performing the redaction, for auditability */
  redactorVersion: z.string().min(1),
});
export type PiiAudit = z.infer<typeof PiiAudit>;

export const EventMetrics = z
  .object({
    latencyMs: z.number().nonnegative().optional(),
    tokensIn: z.number().int().nonnegative().optional(),
    tokensOut: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
  })
  .strict();
export type EventMetrics = z.infer<typeof EventMetrics>;

export const EventEnvelope = z
  .object({
    schemaVersion: z.literal(EVENT_SCHEMA_VERSION).default(EVENT_SCHEMA_VERSION),
    id: Uuid,
    /** stamped server-side from the authenticated key; clients send "" */
    workspaceId: z.string(),
    traceId: TraceId,
    spanId: SpanId,
    parentSpanId: SpanId.nullish(),
    conversationId: z.string().min(1),
    sessionId: z.string().min(1).nullish(),
    name: z.string().min(1).max(512),
    kind: EventKind,
    status: EventStatus.default("ok"),
    errorMessage: z.string().max(4096).nullish(),
    attributes: z.record(z.unknown()).default({}),
    metrics: EventMetrics.default({}),
    /** pointer to full unredacted-at-source transcript blob in object storage */
    transcriptRef: z.string().nullish(),
    piiAudit: PiiAudit,
    /** client-side epoch millis; server normalizes to UTC on ingest */
    timestampMs: z.number().int().nonnegative(),
  })
  .strict();
export type EventEnvelope = z.infer<typeof EventEnvelope>;

/** Wire format accepted at POST /v1/events — a single event or batch. */
export const EventsPayload = z.union([EventEnvelope, z.array(EventEnvelope).min(1).max(1000)]);
export type EventsPayload = z.infer<typeof EventsPayload>;
