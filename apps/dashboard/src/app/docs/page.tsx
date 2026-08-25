import { Icon } from "@/components/icon";

export const metadata = { title: "Docs — Diagnost AI" };

function Code({ children }: { children: string }) {
  return (
    <pre className="my-2 overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-[12px] leading-5 text-gray-700">
      {children}
    </pre>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 text-[14px] font-semibold text-gray-900">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[13px] leading-5 text-gray-600">{children}</p>;
}

export default function DocsPage() {
  return (
    <div className="px-6 pt-5 pb-16 max-w-3xl">
      <h1 className="text-[15px] font-semibold text-gray-900">Documentation</h1>

      <H2>Quickstart</H2>
      <P>
        Bring up the full self-hosted stack (Postgres, ClickHouse, Redpanda, MinIO, MailHog),
        apply migrations, and seed the dev workspace:
      </P>
      <Code>{`docker compose up -d --wait
pnpm --filter @diagnost/db migrate && pnpm --filter @diagnost/db seed
pnpm build`}</Code>
      <P>Run the services:</P>
      <Code>{`node apps/api/dist/index.js        # ingestion API :4100
node apps/api/dist/consumer.js     # Kafka → ClickHouse + S3
node apps/api/dist/notifier.js     # alert delivery (Slack/SMTP)`}</Code>

      <H2>Instrumenting an agent (TypeScript)</H2>
      <P>
        Already emitting OpenTelemetry spans (LangChain, Vercel AI SDK, LlamaIndex, MCP)?
        Point your exporter at Diagnost — three lines:
      </P>
      <Code>{`import { createSpanExporter } from "@diagnost/sdk-ts";
const exporter = createSpanExporter({ endpoint: "http://localhost:4100", apiKey: process.env.DIAGNOST_API_KEY! });
new NodeSDK({ spanProcessor: new BatchSpanProcessor(exporter) }).start();`}</Code>
      <P>Or use the manual checkpoint API:</P>
      <Code>{`import { createClient } from "@diagnost/sdk-ts";
const dx = createClient({ endpoint: "http://localhost:4100", apiKey: process.env.DIAGNOST_API_KEY! });
dx.checkpoint("order.lookup", { orderId });`}</Code>
      <P>
        <strong>PII redaction is default-on</strong>: emails, phone numbers, SSNs, credit
        cards (Luhn-validated) and named entities are hashed before anything leaves your
        process, with a per-event audit log. Zero-PII mode strips all string content.
        Known gaps are listed in <code className="font-mono text-[12px]">docs/pii.md</code>;
        add custom rules via the <code className="font-mono text-[12px]">redaction.customRules</code> option.
      </P>

      <H2>Plans &amp; billing</H2>
      <P>
        Usage is metered per workspace (monthly ingested events). Quotas are enforced at
        the ingestion edge — over-quota workspaces receive HTTP 402 until upgraded.
        Free 50k/mo · Starter 250k/mo $49 · Pro 2M/mo $299 · Enterprise custom. Manage
        tiers under <strong>Settings</strong>; every change lands in the audit log.
      </P>

      <H2>Self-hosting &amp; cloud</H2>
      <P>
        The stack runs fully self-hosted via Docker Compose. For cloud deployments use
        the Terraform modules:
      </P>
      <Code>{`cd infra/terraform/aws
terraform init && terraform plan -var="key_name=your-key"`}</Code>
      <P>
        AWS module provisions VPC, RDS Postgres, S3, ECS Fargate services (api, consumer,
        notifier, dashboard, pr-bot) and single-node ClickHouse + Redpanda on ECS with EBS
        volumes. A GCP skeleton (Compute Engine + Cloud SQL + GCS) is in{" "}
        <code className="font-mono text-[12px]">infra/terraform/gcp</code>.
      </P>

      <H2>Auto-instrument with an AI coding agent</H2>
      <P>
        The <code className="font-mono text-[12px]">agent-analytics</code> skill teaches any
        coding agent to instrument a target codebase automatically:
      </P>
      <Code>{`npx skills add diagnost/skills --skill agent-analytics`}</Code>

      <div className="mt-8 flex items-center gap-2 text-[12px] text-gray-400">
        <Icon name="shield" className="h-3.5 w-3.5" />
        Self-hostable from the Free tier. PII never leaves your infrastructure unredacted.
      </div>
    </div>
  );
}
