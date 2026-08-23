/**
 * Eval-case generation from real cluster evidence.
 *
 * Invalid-date cases are derived from the exact impossible dates observed in
 * failing conversations; valid-date cases come from passing conversations of
 * the same intent (held-out regression material).
 */
import type { ClickHouseClient } from "@clickhouse/client";
import { createClickhouse } from "@diagnost/db";

export interface EvalCase {
  id: string;
  kind: "invalid_date" | "valid_date";
  input: string;
  sourceConversationId: string | null;
}

export interface ConvText {
  conversation_id: string;
  text: string;
}

/** Transcript text for a set of conversations (redacted inline payloads). */
export async function fetchConversationTexts(
  ch: ClickHouseClient,
  database: string,
  conversationIds: string[]
): Promise<ConvText[]> {
  if (conversationIds.length === 0) return [];
  const quoted = conversationIds.map((c) => `'${c.replace(/'/g, "")}'`).join(",");
  const res = await ch.query({
    query: `
      SELECT conversation_id,
             arrayStringConcat(
               arrayMap(m -> JSONExtractString(m,'content'),
                        arrayFlatten(groupArray(
                          if(JSONHas(attributes,'messages'),
                             JSONExtractArrayRaw(attributes,'messages'), [])
                        ))),
               ' ') AS text
      FROM ${database}.events
      WHERE conversation_id IN (${quoted})
      GROUP BY conversation_id
    `,
    format: "JSONEachRow",
  });
  return (await res.json()) as ConvText[];
}

const DATE_TOKEN = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

function extractDates(text: string): { raw: string; y: number; m: number; d: number }[] {
  const out: { raw: string; y: number; m: number; d: number }[] = [];
  for (const match of text.matchAll(DATE_TOKEN)) {
    out.push({
      raw: match[0],
      y: Number(match[1]),
      m: Number(match[2]),
      d: Number(match[3]),
    });
  }
  return out;
}

function isImpossible(d: { y: number; m: number; d: number }): boolean {
  if (d.m < 1 || d.m > 12) return true;
  if (d.d < 1 || d.d > 31) return true;
  return d.d > new Date(Date.UTC(d.y, d.m, 0)).getUTCDate();
}

export interface CaseBundle {
  target: EvalCase[];
  heldOut: EvalCase[];
}

/**
 * @param failing texts of conversations flagged has_error=true
 * @param passing texts of same-intent previously-passing conversations
 */
export function buildCaseBundle(failing: ConvText[], passing: ConvText[]): CaseBundle {
  const target: EvalCase[] = [];
  const heldOut: EvalCase[] = [];

  for (const conv of failing) {
    for (const d of extractDates(conv.text)) {
      if (!isImpossible(d)) continue;
      const id = `inv_${d.raw}`;
      if (target.some((c) => c.id === id)) continue;
      target.push({
        id,
        kind: "invalid_date",
        input: `Please confirm my booking for ${d.raw}.`,
        sourceConversationId: conv.conversation_id,
      });
      if (target.length >= 8) break;
    }
    if (target.length >= 8) break;
  }

  // guarantee at least a couple of canonical invalid-month probes so the
  // gate can measure improvement even on sparse clusters
  for (const raw of ["2026-13-05", "2026-02-30"]) {
    if (!target.some((c) => c.input.includes(raw))) {
      target.push({ id: `inv_${raw}`, kind: "invalid_date", input: `Please confirm my booking for ${raw}.`, sourceConversationId: null });
    }
  }

  for (const conv of passing) {
    for (const d of extractDates(conv.text)) {
      if (isImpossible(d)) continue;
      const id = `val_${d.raw}`;
      if (heldOut.some((c) => c.id === id)) continue;
      heldOut.push({
        id,
        kind: "valid_date",
        input: `Please confirm my booking for ${d.raw}.`,
        sourceConversationId: conv.conversation_id,
      });
      if (heldOut.length >= 6) break;
    }
    if (heldOut.length >= 6) break;
  }
  // floor for regression coverage
  for (const raw of ["2026-07-04", "2025-11-19"]) {
    if (!heldOut.some((c) => c.input.includes(raw))) {
      heldOut.push({ id: `val_${raw}`, kind: "valid_date", input: `Please confirm my booking for ${raw}.`, sourceConversationId: null });
    }
  }

  return { target, heldOut };
}

/** Grader shared by offline + live modes. */
export function grade(caseItem: EvalCase, response: string): boolean {
  const raw = /(\d{4}-\d{2}-\d{2})/.exec(caseItem.input)?.[1];
  if (caseItem.kind === "invalid_date") {
    // correct behavior: never confirms an impossible date
    if (raw && response.includes(raw) && /confirm/i.test(response)) return false;
    return !/confirm/i.test(response);
  }
  // valid_date: must confirm with the exact date intact
  return !!raw && response.toLowerCase().includes(raw.toLowerCase()) && /confirm/i.test(response);
}

export function makeChReader(opts: {
  url: string;
  username: string;
  password: string;
  database: string;
}): ClickHouseClient {
  return createClickhouse(opts);
}
