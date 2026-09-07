import { H1, Lead, H2, P, Code, Inline, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "Quickstart — Diagnost AI Docs" };

export default function QuickstartPage() {
  return (
    <div>
      <H1>Quickstart</H1>
      <Lead>Get from zero to live analytics in about 10 minutes, all on your machine.</Lead>

      <H2>1. Start the infrastructure</H2>
      <P>Postgres, ClickHouse, Redpanda, MinIO and MailHog via Docker Compose:</P>
      <Code>{`git clone https://github.com/shashwat558/diagnost-ai
cd diagnost-ai
pnpm install
docker compose up -d --wait`}</Code>

      <H2>2. Migrate and seed</H2>
      <Code>{`pnpm --filter @diagnost/db migrate
pnpm --filter @diagnost/db seed   # dev workspace + owner login`}</Code>
      <P>
        This creates the dev workspace (<Inline>ws_dev</Inline>), an API key, and the owner
        account <Inline>owner@dev.local</Inline> / <Inline>devpassword123</Inline>.
      </P>

      <H2>3. Run the services</H2>
      <Code>{`pnpm build
node apps/api/dist/index.js      # ingestion API :4100
node apps/api/dist/consumer.js   # Kafka → ClickHouse + S3
node apps/api/dist/notifier.js   # alert delivery
pnpm --filter @diagnost/dashboard start  # dashboard :3100`}</Code>

      <H2>4. Send your first event</H2>
      <P>Sign up at <Inline>:3100/signup</Inline> for a real API key, or use the dev key. Then:</P>
      <Code>{`curl -X POST http://localhost:4100/v1/events \\
  -H 'content-type: application/json' \\
  -H "authorization: Bearer <API_KEY>" \\
  -d '[{"id":"<uuid>","workspaceId":"","traceId":"<32 hex>","spanId":"<16 hex>",
       "conversationId":"demo_1","name":"order.lookup","kind":"checkpoint",
       "piiAudit":{"redactions":[],"zeroPiiMode":false,"redactorVersion":"t"},
       "timestampMs":1700000000000}]'
# → {"accepted":1}`}</Code>

      <H2>5. See it</H2>
      <P>
        Open <Inline>:3100/dashboard</Inline> — your event is in the volume chart and
        Conversations within seconds. For a full demo dataset with failures, run{" "}
        <Inline>bash tools/demo/run.sh phase2</Inline> (16k conversations, 3 failure patterns,
        1 drift alert).
      </P>

      <PrevNext
        prev={{ href: "/docs", label: "Overview" }}
        next={{ href: "/docs/instrumentation", label: "Instrument your agent" }}
      />
    </div>
  );
}
