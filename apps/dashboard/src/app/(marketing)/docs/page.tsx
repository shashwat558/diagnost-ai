import Link from "next/link";
import { H1, Lead, H2, P, Code, Inline, Callout, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "Docs — Diagnost AI" };

export default function DocsIndexPage() {
  return (
    <div>
      <H1>Diagnost AI documentation</H1>
      <Lead>
        Production analytics and self-improvement for AI agents. Instrument once, then see every
        failure, get alerted on regressions, and ship verified fixes — all from your own data.
      </Lead>

      <H2>How it works</H2>
      <P>
        <strong>1. Instrument</strong> your agent with the SDK (OpenTelemetry exporter or manual
        checkpoints) → <strong>2. Events stream in</strong> via the ingestion API →{" "}
        <strong>3. The platform clusters failures</strong> into ranked intents and watches for
        drift → <strong>4. You get alerted</strong> on Slack/email → <strong>5. Auto-fix PRs</strong>{" "}
        ship with eval reports → <strong>6. Specialists</strong> distill your traffic into small,
        cheap models.
      </P>

      <H2>Quickstart</H2>
      <P>
        The fastest path: bring up the stack locally, instrument the sample agent, and watch data
        flow. Full steps on the <Link href="/docs/quickstart" className="text-accent hover:underline">Quickstart page</Link>:
      </P>
      <Code>{`docker compose up -d --wait
pnpm --filter @diagnost/db migrate
node apps/api/dist/index.js & node apps/api/dist/consumer.js &
# add 3 lines to your agent, send traffic, open :3100`}</Code>

      <H2>Where to go next</H2>
      <P>
        <Link href="/docs/instrumentation" className="text-accent hover:underline">Instrument your agent</Link> — SDK, checkpoints,
        PII redaction. <Link href="/docs/concepts" className="text-accent hover:underline">Core concepts</Link> — events,
        intents, drift, models. <Link href="/docs/self-host" className="text-accent hover:underline">Self-hosting</Link> — one-command
        VPS install or Terraform. Prefer an AI to do it?{" "}
        <Link href="/docs/skill" className="text-accent hover:underline">skills add</Link> the agent-analytics skill
        (<Inline>npx skills add shashwat558/diagnost-ai --skill agent-analytics</Inline>).
      </P>
      <Callout>
        Self-hostable from the Free tier. PII never leaves your infrastructure unredacted —
        redaction runs inside your agent process before anything is sent.
      </Callout>

      <PrevNext next={{ href: "/docs/quickstart", label: "Quickstart" }} />
    </div>
  );
}
