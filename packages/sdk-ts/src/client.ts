import { randomUUID, randomBytes } from "node:crypto";
import {
  EVENT_SCHEMA_VERSION,
  type EventEnvelope,
  type EventKind,
  type PiiAudit,
} from "@diagnost/core";
import { redactValue, type RedactionFinding, type RedactOptions } from "./redact.js";

export const REDACTOR_VERSION = "sdk-ts@0.1.0";

export interface DiagnostClientOpts {
  /** ingestion endpoint, e.g. http://localhost:4100 */
  endpoint: string;
  /** workspace API key (dw_...) */
  apiKey: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  redaction?: RedactOptions;
  /** default conversation id for manual checkpoints (defaults: per-process uuid) */
  conversationId?: string;
  debug?: boolean;
}

type QueuedEvent = EventEnvelope;

export class DiagnostClient {
  private queue: QueuedEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> = Promise.resolve();
  private readonly opts: Required<Omit<DiagnostClientOpts, "conversationId">> & {
    conversationId?: string;
  };
  private defaultConversationId = `conv_${randomUUID()}`;

  constructor(opts: DiagnostClientOpts) {
    this.opts = {
      flushIntervalMs: opts.flushIntervalMs ?? 2_000,
      maxBatchSize: opts.maxBatchSize ?? 100,
      redaction: opts.redaction ?? {},
      debug: opts.debug ?? false,
      endpoint: opts.endpoint,
      apiKey: opts.apiKey,
      conversationId: opts.conversationId,
    };
  }

  // ── ids ───────────────────────────────────────────────────────

  static newTraceId(): string {
    return randomBytes(16).toString("hex");
  }

  static newSpanId(): string {
    return randomBytes(8).toString("hex");
  }

  get conversationId(): string {
    return this.opts.conversationId ?? this.defaultConversationId;
  }

  // ── public API ────────────────────────────────────────────────

  /**
   * Manual checkpoint — the fastest way to instrument an agent step.
   * Redaction is applied to metadata automatically.
   */
  checkpoint(
    name: string,
    metadata: Record<string, unknown> = {},
    ctx: {
      traceId?: string;
      parentSpanId?: string;
      conversationId?: string;
      sessionId?: string;
      status?: "ok" | "error";
      kind?: EventKind;
      metrics?: EventEnvelope["metrics"];
    } = {}
  ): void {
    const redacted = this.applyRedaction(metadata);
    this.enqueue({
      schemaVersion: EVENT_SCHEMA_VERSION,
      id: randomUUID(),
      workspaceId: "", // stamped server-side
      traceId: ctx.traceId ?? DiagnostClient.newTraceId(),
      spanId: DiagnostClient.newSpanId(),
      parentSpanId: ctx.parentSpanId ?? null,
      conversationId: ctx.conversationId ?? this.conversationId,
      sessionId: ctx.sessionId ?? null,
      name,
      kind: ctx.kind ?? "checkpoint",
      status: ctx.status ?? "ok",
      errorMessage: null,
      attributes: redacted.attributes,
      metrics: ctx.metrics ?? {},
      transcriptRef: null,
      piiAudit: redacted.audit,
      timestampMs: Date.now(),
    });
  }

  /** Alias with event-kind flexibility for advanced use. */
  track(event: {
    name: string;
    kind?: EventKind;
    attributes?: Record<string, unknown>;
    status?: "ok" | "error";
    errorMessage?: string | null;
    metrics?: EventEnvelope["metrics"];
    conversationId?: string;
    sessionId?: string;
    traceId?: string;
    parentSpanId?: string;
    timestampMs?: number;
  }): void {
    const redacted = this.applyRedaction(event.attributes ?? {});
    this.enqueue({
      schemaVersion: EVENT_SCHEMA_VERSION,
      id: randomUUID(),
      workspaceId: "",
      traceId: event.traceId ?? DiagnostClient.newTraceId(),
      spanId: DiagnostClient.newSpanId(),
      parentSpanId: event.parentSpanId ?? null,
      conversationId: event.conversationId ?? this.conversationId,
      sessionId: event.sessionId ?? null,
      name: event.name,
      kind: event.kind ?? "checkpoint",
      status: event.status ?? "ok",
      errorMessage: event.errorMessage ?? null,
      attributes: redacted.attributes,
      metrics: event.metrics ?? {},
      transcriptRef: null,
      piiAudit: redacted.audit,
      timestampMs: event.timestampMs ?? Date.now(),
    });
  }

  /**
   * Internal path used by the OTel exporter — skips re-redacting already
   * processed attribute trees but attaches the provided audit log.
   */
  enqueueRaw(envelope: EventEnvelope): void {
    this.queue.push(envelope);
    if (this.queue.length >= this.opts.maxBatchSize) {
      void this.flush();
    }
  }

  /** Redact attributes; returns payload + audit log. Never throws. */
  applyRedaction(attributes: Record<string, unknown>): {
    attributes: Record<string, unknown>;
    audit: PiiAudit;
  } {
    try {
      const result = redactValue(attributes, this.opts.redaction);
      return {
        attributes: result.value as Record<string, unknown>,
        audit: {
          redactions: result.findings as RedactionFinding[],
          zeroPiiMode: this.opts.redaction.zeroPiiMode ?? false,
          redactorVersion: REDACTOR_VERSION,
        },
      };
    } catch {
      // fail-open: never break the host agent because redaction hiccuped
      return {
        attributes,
        audit: { redactions: [], zeroPiiMode: false, redactorVersion: `${REDACTOR_VERSION}+degraded` },
      };
    }
  }

  enqueue(envelope: EventEnvelope): void {
    this.queue.push(envelope);
    if (this.queue.length >= this.opts.maxBatchSize) {
      void this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.opts.flushIntervalMs);
      this.timer.unref?.();
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.opts.maxBatchSize);
    this.flushing = this.flushing.then(() => this.sendWithRetry(batch)).catch((err) => {
      if (this.opts.debug) console.warn("[diagnost] batch dropped:", err?.message ?? err);
    });
    await this.flushing;
  }

  async shutdown(): Promise<void> {
    // drain everything regardless of maxBatchSize
    while (this.queue.length > 0) {
      await this.flush();
    }
    await this.flushing;
  }

  private async sendWithRetry(batch: QueuedEvent[], attempt = 1): Promise<void> {
    try {
      const res = await fetch(`${this.opts.endpoint}/v1/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok && attempt < 3) {
        throw new Error(`http ${res.status}`);
      }
      if (!res.ok && this.opts.debug) {
        console.warn(`[diagnost] server rejected batch (${res.status})`);
      }
    } catch (err) {
      if (attempt < 3) {
        const backoff = 200 * 2 ** (attempt - 1) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, backoff));
        return this.sendWithRetry(batch, attempt + 1);
      }
      throw err;
    }
  }
}

/** Convenience factory. */
export function createClient(opts: DiagnostClientOpts): DiagnostClient {
  return new DiagnostClient(opts);
}
