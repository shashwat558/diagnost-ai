import { H1, Lead, H2, P, Code, Inline, DocTable, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "API reference — Diagnost AI Docs" };

export default function ApiReferencePage() {
  return (
    <div>
      <H1>API reference</H1>
      <Lead>
        Two auth modes: ingestion uses <Inline>Authorization: Bearer &lt;api-key&gt;</Inline>;
        dashboard routes use the session cookie (login first). Admin-only routes need
        owner/admin role.
      </Lead>

      <H2>Ingestion</H2>
      <DocTable
        head={["Endpoint", "What it does"]}
        rows={[
          ["POST /v1/events", "Ingest 1–1000 event envelopes → 202 {accepted}. 400 validation, 401 bad key, 402 quota, 503 queue down."],
          ["GET /healthz", "Liveness: {ok, component, version, queue}. No auth."],
          ["GET /readyz", "Readiness: postgres + ClickHouse + queue checks. 503 if any fail. No auth."],
        ]}
      />
      <P>Envelope essentials:</P>
      <Code>{`{
  "id": "<uuid>", "workspaceId": "",        // stamped server-side from your key
  "traceId": "<32 hex>", "spanId": "<16 hex>",
  "conversationId": "user-session-1",
  "name": "order.lookup", "kind": "checkpoint",   // agent|llm|tool|retrieval|checkpoint|session
  "status": "ok",                                  // ok|error
  "errorMessage": null, "attributes": {}, "metrics": {},
  "piiAudit": {"redactions":[],"zeroPiiMode":false,"redactorVersion":"t"},
  "timestampMs": 1700000000000
}`}</Code>

      <H2>Auth & billing</H2>
      <DocTable
        head={["Endpoint", "What it does"]}
        rows={[
          ["POST /api/auth/signup", "Create workspace + owner + API key (shown once) → 201."],
          ["POST /api/auth/login", "Email + password → session cookie."],
          ["POST /api/auth/logout", "Destroy session."],
          ["GET /api/auth/me", "Current user, role, workspace, plan."],
          ["POST /api/billing/checkout {plan}", "Admin. Free downgrades directly; starter/pro → Dodo checkout URL (or dev-mode flip)."],
          ["POST /api/billing/webhook", "Dodo Standard-Webhooks receiver → flips workspaces.plan. Dev-mode accepts {workspaceId, plan}."],
          ["POST /api/billing/portal", "Customer portal URL (or dev-mode message)."],
        ]}
      />

      <H2>Workspace data</H2>
      <DocTable
        head={["Endpoint", "What it does"]}
        rows={[
          ["GET /api/channels", "List notification channels (Slack targets masked). Admin."],
          ["POST /api/channels {channel, target}", "Add channel. 400 invalid, 409 duplicate. Admin."],
          ["PATCH /api/channels/:id {enabled}", "Toggle. Admin."],
          ["DELETE /api/channels/:id", "Remove. Admin."],
          ["POST /api/channels/:id/test", "Send a real test message. 502 on provider error. Admin."],
          ["GET /api/instructions", "List versioned prompt artifacts."],
          ["POST /api/instructions {name, handles_intent, content}", "Save prompt v1 (audited). 409 on duplicate name."],
          ["GET /api/clusters", "Intent rows for the workspace (table data)."],
          ["GET /api/features", "Ranked feature requests."],
        ]}
      />

      <PrevNext
        prev={{ href: "/docs/self-host", label: "Self-hosting" }}
        next={{ href: "/docs/skill", label: "Agent skill" }}
      />
    </div>
  );
}
