import { createHash } from "node:crypto";
import type { DetectorType, RedactionAction } from "@diagnost/core";

/**
 * Default-on PII redaction pipeline.
 *
 * Runs entirely inside the customer's process BEFORE anything is sent.
 * Every finding is recorded in an audit log that ships with the event —
 * raw matched values are never logged, only counts and categories.
 *
 * Known gaps (documented in docs/pii.md): heuristic NER is best-effort;
 * customers can add custom rules for domain-specific identifiers.
 */

export interface CustomRule {
  /** detector category recorded in the audit log */
  name: string;
  pattern: RegExp;
  action?: RedactionAction;
}

export interface RedactOptions {
  /** strip all string content, keep structure/metadata only */
  zeroPiiMode?: boolean;
  /** lightweight named-entity heuristic (default: on) */
  nerHeuristic?: boolean;
  /** customer-supplied detectors, run after built-ins */
  customRules?: CustomRule[];
}

export interface RedactionFinding {
  field: string;
  type: DetectorType | "custom";
  action: RedactionAction;
  count: number;
}

export interface RedactResult {
  value: unknown;
  findings: RedactionFinding[];
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
// candidate digit runs; validated with Luhn before redacting
const CARD_CANDIDATE_RE = /\b(?:\d[ -]?){13,19}\b/g;
// intl-ish phone numbers: maximal digit run (with separators), validated by
// digit-count range AFTER matching so long non-phone runs survive untouched
const PHONE_CANDIDATE_RE = /\b\+?\d[\d\s./()-]{7,30}\d\b/g;
// lightweight NER: two consecutive Capitalized words (person/org/place-ish)
const NAME_SEQ_RE = /\b[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)+\b/g;

const NON_NAME_PREFIX =
  /^(The|This|That|These|Those|There|Here|When|What|Where|Why|How|If|And|But|Our|Your|Their)\b/;

function sha8(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

type FindingsMap = Map<string, number>;

function record(findings: FindingsMap, field: string, type: string, action: RedactionAction): void {
  const key = `${field}|${type}|${action}`;
  findings.set(key, (findings.get(key) ?? 0) + 1);
}

/** Apply ordered detectors to a single string at a known path. */
function redactString(
  input: string,
  field: string,
  opts: { zeroPiiMode: boolean; nerHeuristic: boolean },
  customRules: CustomRule[],
  findings: FindingsMap
): string {
  let out = input;

  // zero-PII mode: no string content leaves the process at all
  if (opts.zeroPiiMode && out.length > 0) {
    record(findings, field, "custom", "strip");
    return "[ZERO_PII]";
  }

  // credit card first — digit runs overlap with phone candidates
  out = out.replace(CARD_CANDIDATE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    if (!luhnValid(digits)) return m;
    record(findings, field, "credit_card", "hash");
    return `[CARD:${sha8(digits)}]`;
  });

  out = out.replace(SSN_RE, (m) => {
    record(findings, field, "ssn", "hash");
    return `[SSN:${sha8(m)}]`;
  });

  out = out.replace(EMAIL_RE, (m) => {
    record(findings, field, "email", "hash");
    return `[EMAIL:${sha8(m)}]`;
  });

  out = out.replace(PHONE_CANDIDATE_RE, (m) => {
    const digits = digitCount(m);
    if (digits < 10 || digits > 15) return m;
    record(findings, field, "phone", "hash");
    return `[PHONE:${sha8(m)}]`;
  });

  if (opts.nerHeuristic) {
    out = out.replace(NAME_SEQ_RE, (m) => {
      if (NON_NAME_PREFIX.test(m)) return m;
      record(findings, field, "named_entity", "hash");
      return `[NAME:${sha8(m)}]`;
    });
  }

  for (const rule of customRules) {
    const action: RedactionAction = rule.action ?? "hash";
    out = out.replace(rule.pattern, (m) => {
      record(findings, field, "custom", action);
      return action === "strip" ? "[REDACTED]" : `[${rule.name}:${sha8(m)}]`;
    });
  }

  return out;
}

/** Normalize array indices so paths aggregate: messages[].role */
function normalizePath(p: string): string {
  return p.replace(/\[\d+\]/g, "[]");
}

/** Recursively redact strings in arbitrary JSON-like values. */
export function redactValue(value: unknown, opts: RedactOptions = {}): RedactResult {
  const mergedOpts = {
    zeroPiiMode: opts.zeroPiiMode ?? false,
    nerHeuristic: opts.nerHeuristic ?? true,
  };
  const customRules = opts.customRules ?? [];
  const findings: FindingsMap = new Map();

  const walk = (v: unknown, p: string): unknown => {
    if (typeof v === "string") {
      return redactString(v, p ? normalizePath(p) : "(root)", mergedOpts, customRules, findings);
    }
    if (Array.isArray(v)) return v.map((item, i) => walk(item, `${p}[${i}]`));
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        out[k] = walk(val, p ? `${p}.${k}` : k);
      }
      return out;
    }
    return v;
  };

  const result = walk(value, "");

  const list: RedactionFinding[] = [...findings.entries()].map(([key, count]) => {
    const [field, type, action] = key.split("|");
    return {
      field: field!,
      type: type as DetectorType,
      action: action as RedactionAction,
      count,
    };
  });

  return { value: result, findings: list };
}
