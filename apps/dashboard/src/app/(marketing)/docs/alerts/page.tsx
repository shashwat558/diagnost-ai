import { H1, Lead, H2, P, Code, Inline, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "Alerts & notifications — Diagnost AI Docs" };

export default function AlertsPage() {
  return (
    <div>
      <H1>Alerts & notifications</H1>
      <Lead>Drift alerts fan out to Slack and email — rate-limited, testable, self-manageable.</Lead>

      <H2>How delivery works</H2>
      <P>
        The <Inline>notifier</Inline> worker polls undelivered alerts every 5 seconds and sends to
        every enabled channel in the workspace. Rate limiting: <strong>one notification per intent
        per hour</strong> — repeats are recorded as <Inline>skipped</Inline> so the UI shows what
        was muted. Every attempt lands in the delivery ledger (
        <Inline>sent</Inline> / <Inline>failed</Inline> / <Inline>skipped</Inline>).
      </P>

      <H2>Manage channels</H2>
      <P>
        <strong>Settings → Alert notifications</strong> (owner/admin): add an email address or Slack
        webhook URL, enable/disable, remove, or <strong>Send test</strong> to verify delivery
        end-to-end. Invalid addresses are rejected; delivery failures surface the provider error
        with what to check.
      </P>

      <H2>Email setup</H2>
      <P>Locally, mail goes to MailHog (<Inline>:8025</Inline>) — no config needed. In production, set:</P>
      <Code>{`SMTP_URL=smtp://user:pass@smtp.resend.com:587
SMTP_FROM=alerts@your-domain.com
DASHBOARD_URL=https://your-domain.com   # links inside alert emails`}</Code>
      <P>
        Any SMTP provider works (Resend, SES, Postmark): STARTTLS on 587 is automatic, append{" "}
        <Inline>?secure=true</Inline> for port-465 SMTPS. Alert links point at{" "}
        <Inline>DASHBOARD_URL</Inline>.
      </P>

      <H2>Slack setup</H2>
      <P>
        Create an Incoming Webhook in your Slack workspace (
        <Inline>https://hooks.slack.com/…</Inline>) and paste it as a channel target. Alerts arrive
        formatted with severity, type, message and a link to the intent.
      </P>

      <PrevNext
        prev={{ href: "/docs/dashboard-tour", label: "Dashboard tour" }}
        next={{ href: "/docs/billing", label: "Plans & billing" }}
      />
    </div>
  );
}
