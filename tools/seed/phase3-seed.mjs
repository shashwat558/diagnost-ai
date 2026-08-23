/**
 * Phase 3 seed: conversations containing repeated unmet feature requests.
 *
 *   csv_export        ×25
 *   slack_integration ×15
 *   dark_mode         ×8
 *   webhooks_api      ×5
 *   one-off requests  ×6 (each frequency=1, exercises fallback slug derivation)
 */
const API = process.env.DIAGNOST_ENDPOINT ?? "http://localhost:4100";
const KEY = process.env.DIAGNOST_API_KEY ?? "dw_local_devkey_diagnost_00000000";

const { randomUUID } = await import("node:crypto");
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260823);
const hex = (n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rand() * 16)]).join("");
const audit = { redactions: [], zeroPiiMode: false, redactorVersion: "seed@3.0" };
const NOW = Date.now();

function transcript(pairs) {
  return JSON.stringify(pairs.map(([role, content]) => ({ role, content })));
}

// phrasing variants per feature; all keep the signature keywords
const REQUESTS = {
  csv_export: [
    ["Can you add CSV export of our chat transcripts?", "I'm sorry, exporting to CSV isn't supported yet."],
    ["Is there a way to export conversations to a CSV file?", "Currently there is no CSV export available."],
    ["We really need CSV export for compliance reviews.", "CSV export isn't something I can do today."],
    ["Please add CSV export in the dashboard.", "That isn't supported at the moment."],
  ],
  slack_integration: [
    ["Does it support Slack integration?", "Slack integration isn't available yet."],
    ["Can you integrate with Slack? Our team lives there.", "I can't connect to Slack today."],
    ["We need Slack integration for incident channels.", "Slack support is not available."],
  ],
  dark_mode: [
    ["Would be nice if it had dark mode for night shifts.", "Dark mode isn't offered right now."],
    ["It would be great if there was a dark theme option for late work.", "There's no dark mode currently."],
  ],
  webhooks_api: [
    ["Can you support webhooks so we can pipe results into our system?", "Webhooks aren't supported at this time."],
    ["Any chance you could expose a public API for pulling events?", "A public API isn't available yet."],
  ],
};

const ONE_OFFS = [
  "I wish it could transcribe voicemail messages automatically.",
  "Feature request: SAML single sign-on for our enterprise plan.",
  "Why can't it reply in German and Spanish?",
  "It would be great if the agent could read PDFs from a URL.",
  "Can you build voice input through the phone?",
  "Is there a way to schedule weekly digest emails?",
];

const conversations = [];
let idx = 0;
function addConv(messages) {
  const id = `conv_seed3_${idx++}`;
  const start = NOW - Math.floor(rand() * 72) * 3600_000;
  conversations.push({ id, trace: hex(32), start, messages });
}

for (const [slug, variants] of Object.entries(REQUESTS)) {
  const count = { csv_export: 25, slack_integration: 15, dark_mode: 8, webhooks_api: 5 }[slug];
  for (let i = 0; i < count; i++) {
    const [user, assistant] = variants[i % variants.length];
    addConv([
      ["user", user],
      ["assistant", assistant],
    ]);
  }
}
for (const msg of ONE_OFFS) addConv([["user", msg], ["assistant", "Noted as feedback."]]);

const events = [];
for (const conv of conversations) {
  events.push({
    schemaVersion: 1, id: randomUUID(), workspaceId: "", traceId: conv.trace,
    spanId: hex(16), parentSpanId: null, conversationId: conv.id, sessionId: null,
    name: "agent.session", kind: "agent", status: "ok", errorMessage: null,
    attributes: {}, metrics: {}, transcriptRef: null, piiAudit: audit,
    timestampMs: conv.start,
  });
  events.push({
    schemaVersion: 1, id: randomUUID(), workspaceId: "", traceId: conv.trace,
    spanId: hex(16), parentSpanId: null, conversationId: conv.id, sessionId: null,
    name: "llm.reply", kind: "llm", status: "ok", errorMessage: null,
    attributes: {
      "diagnost.transcript": transcript(conv.messages),
      "gen_ai.model": "gpt-4o-mini",
    },
    metrics: {}, transcriptRef: null, piiAudit: audit,
    timestampMs: conv.start + 3000,
  });
  if (rand() < 0.5) {
    events.push({
      schemaVersion: 1, id: randomUUID(), workspaceId: "", traceId: conv.trace,
      spanId: hex(16), parentSpanId: null, conversationId: conv.id, sessionId: null,
      name: "user.feedback", kind: "checkpoint",
      status: rand() < 0.7 ? "error" : "ok",
      errorMessage: rand() < 0.7 ? "request not fulfilled by agent" : null,
      attributes: {}, metrics: {}, transcriptRef: null, piiAudit: audit,
      timestampMs: conv.start + 6000,
    });
  }
}

console.log(`[seed3] ${conversations.length} conversations, ${events.length} events`);

async function post(batch, attempt = 1) {
  try {
    const res = await fetch(`${API}/v1/events`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).accepted;
  } catch (err) {
    if (attempt >= 5) throw err;
    await new Promise((r) => setTimeout(r, 500 * attempt));
    return post(batch, attempt + 1);
  }
}

let accepted = 0;
for (let i = 0; i < events.length; i += 500) {
  accepted += await post(events.slice(i, i + 500));
}
console.log(`[seed3] done — accepted ${accepted}; mix: csv=25 slack=15 dark=8 webhooks=5 oneoffs=6`);
