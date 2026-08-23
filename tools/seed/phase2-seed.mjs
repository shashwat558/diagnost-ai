/**
 * Phase 2 seed: 5,000 synthetic conversations over a 48h window.
 *
 *   base      3950  generic support chatter, ~8% random failures (evenly spread)
 *   pattern A  400  "tool_timeout"            — even spread, flat failure rate  (cluster, NO alert)
 *   pattern B  350  "date_format_error"       — failure RATE RAMPS OVER TIME    (cluster + ALERT)
 *   pattern C  300  "refund_hallucination"    — even spread, flat failure rate  (cluster, NO alert)
 *
 * Deterministic RNG so acceptance runs are reproducible.
 */
const API = process.env.DIAGNOST_ENDPOINT ?? "http://localhost:4100";
const KEY = process.env.DIAGNOST_API_KEY ?? "dw_local_devkey_diagnost_00000000";
const WINDOW_H = 48;
const NOW = Date.now();
const HOUR = 3600_000;

// deterministic PRNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260822);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const { randomUUID } = await import("node:crypto");
const uuid = () => randomUUID();
const hex = (n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rand() * 16)]).join("");

const audit = { redactions: [], zeroPiiMode: false, redactorVersion: "seed@2.0" };

function ev(conv, tsMs, name, kind, attrs = {}, extra = {}) {
  return {
    schemaVersion: 1,
    id: uuid(),
    workspaceId: "",
    traceId: conv.trace,
    spanId: hex(16),
    parentSpanId: null,
    conversationId: conv.id,
    sessionId: null,
    name,
    kind,
    status: extra.status ?? "ok",
    errorMessage: extra.error ?? null,
    attributes: attrs,
    metrics: extra.metrics ?? {},
    transcriptRef: null,
    piiAudit: audit,
    timestampMs: Math.round(tsMs),
  };
}

function transcript(pairs) {
  // shipped as a JSON string attribute; platform unpacks to S3 + inline copy
  const msgs = pairs.map(([role, content]) => ({ role, content }));
  return JSON.stringify(msgs);
}

// ── template banks ────────────────────────────────────────────────
// Users hitting the same bug phrase it similarly — patterns below share
// their signature vocabulary, mirroring real-world failure clusters.
const BASE_USER = [
  "Hi, where is my order #8817?",
  "How long does shipping usually take?",
  "I forgot my password and cannot log in.",
  "Do you ship internationally?",
  "Can I change my delivery address after ordering?",
  "What are your support hours?",
  "My tracking number does not work, can you help?",
  "Please send me a copy of my last invoice.",
  "The mobile app crashes when I open settings.",
  "How do I switch the app language to German?",
  "Can I merge two accounts into one?",
  "Where do I download the tax forms?",
  "Do you offer gift wrapping?",
  "Is there a student discount available?",
];
const BASE_ASSISTANT = [
  "Sure, let me look that up for you right away.",
  "Happy to help with that. One moment please.",
  "I can definitely check that for you.",
];

const A_USER = [
  "Checkout shows 'payment gateway timeout' and my card was charged twice.",
  "I got a 'payment gateway timeout' mid-purchase; did the charge go through?",
  "The app says 'payment gateway timeout' whenever I try to pay my invoice.",
];
const A_TOOL_ERR = "payment gateway timeout after 5000ms";

const B_EARLY_OK = [
  "Apologies — known display issue, your booking date was stored correctly and our team will push a corrected confirmation email.",
];
const B_LATE_FAIL = [
  "Your booking is confirmed for the requested slot; ignore any calendar warnings about the wrong date format shown.",
  "Confirmation sent. Note: the system currently renders the wrong date format (month out of range) on receipts.",
];

const C_USER = [
  "I want my money back under your refund policy — this service does not work for me.",
  "Per the refund policy I am entitled to a refund; please process it today.",
];

// ── population ────────────────────────────────────────────────────
const conversations = [];
function addConv(kind) {
  conversations.push({
    idx: conversations.length,
    id: `conv_seed_${conversations.length}`,
    trace: hex(32),
    kind,
    startMs: NOW - WINDOW_H * HOUR + rand() * WINDOW_H * HOUR,
  });
}
for (let i = 0; i < 3950; i++) addConv("base");
for (let i = 0; i < 400; i++) addConv("A_tool_timeout");
for (let i = 0; i < 350; i++) addConv("B_date_format");
for (let i = 0; i < 300; i++) addConv("C_refund");
console.log(`[seed] generating ${conversations.length} conversations...`);

const events = [];
for (const conv of conversations) {
  const ageH = (NOW - conv.startMs) / HOUR;
  const jitter = () => conv.startMs + (events.length % 5) * 2000 + rand() * 8000;

  // 1. session span
  events.push(ev(conv, conv.startMs, "agent.session", "agent"));

  if (conv.kind === "base") {
    const u = pick(BASE_USER);
    const failed = rand() < 0.08;
    events.push(
      ev(conv, jitter(), "llm.reply", "llm", {
        "diagnost.transcript": transcript([
          ["user", u],
          ["assistant", pick(BASE_ASSISTANT)],
        ]),
        "gen_ai.model": "gpt-4o-mini",
      })
    );
    events.push(ev(conv, jitter(), "tool.lookup_order", "tool", { query: u.slice(0, 40) }));
    if (failed) {
      events.push(
        ev(conv, jitter(), "tool.lookup_order", "tool", {}, { status: "error", error: "upstream inventory service unavailable" })
      );
    }
  }

  if (conv.kind === "A_tool_timeout") {
    const failed = rand() < 0.85; // flat high rate — no temporal signal
    events.push(
      ev(conv, jitter(), "llm.reply", "llm", {
        "diagnost.transcript": transcript([
          ["user", pick(A_USER)],
          ["assistant", "Checking the billing system now."],
        ]),
        "gen_ai.model": "gpt-4o-mini",
      }),
      ev(conv, jitter(), "tool.billing_lookup", "tool", { system: "payments-v2" },
        failed ? { status: "error", error: A_TOOL_ERR } : {}),
      ev(conv, jitter(), "user.feedback", "checkpoint", { rating: failed ? 1 : 3 })
    );
  }

  if (conv.kind === "B_date_format") {
    // FAILURE RATE RAMPS WITH TIME: old ≈ self-corrected (ok), recent ≈ hard fail.
    const errProb = ageH > 24 ? 0.2 : ageH > 8 ? 0.55 : 0.95;
    const failed = rand() < errProb;
    const reply = failed ? pick(B_LATE_FAIL) : pick(B_EARLY_OK);
    events.push(
      ev(conv, jitter(), "llm.booking_reply", "llm", {
        "diagnost.transcript": transcript([
          ["user", "I think you sent me a wrong date format for my booking."],
          ["assistant", reply],
        ]),
        "gen_ai.model": "gpt-4o-mini",
      }, failed ? { status: "error", error: "invalid_date_format rendered to customer" } : {}),
      ev(conv, jitter(), "tool.render_confirmation", "tool", { format: failed ? "YYYY-13-DD" : "YYYY-MM-DD" },
        failed ? { status: "error", error: "month out of range" } : {}),
      ev(conv, jitter(), "user.feedback", "checkpoint", { rating: failed ? 1 : 4 })
    );
  }

  if (conv.kind === "C_refund") {
    const failed = rand() < 0.55; // flat mid rate — no temporal signal
    events.push(
      ev(conv, jitter(), "llm.reply", "llm", {
        "diagnost.transcript": transcript([
          ["user", pick(C_USER)],
          ["assistant", "Good news — you are eligible for a full refund under our refund policy, no questions asked."],
          ["assistant", "Actually, per policy exceptions, this refund is final once processed and cannot be reversed."],
        ]),
        "gen_ai.model": "gpt-4o-mini",
      }),
      ev(conv, jitter(), "user.feedback", "checkpoint", { rating: 2 }),
    );
    if (failed) {
      events.push(
        ev(conv, jitter(), "tool.refund_submit", "tool", {}, { status: "error", error: "policy conflict: contradictory guidance given" })
      );
    }
  }
}

console.log(`[seed] ${events.length} events; posting to ${API}...`);

async function post(batch, attempt = 1) {
  try {
    const res = await fetch(`${API}/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()).accepted;
  } catch (err) {
    if (attempt >= 5) throw err;
    await new Promise((r) => setTimeout(r, 500 * attempt));
    return post(batch, attempt + 1);
  }
}

const BATCH = 500;
let accepted = 0;
for (let i = 0; i < events.length; i += BATCH) {
  accepted += await post(events.slice(i, i + BATCH));
  if ((i / BATCH) % 8 === 0) console.log(`[seed] posted ${i + Math.min(BATCH, events.length - i)}/${events.length}`);
}
console.log(`[seed] done — API accepted ${accepted} events`);
console.log("[seed] mix: base=3950 A_tool_timeout=400 B_date_format=350 C_refund=300");
