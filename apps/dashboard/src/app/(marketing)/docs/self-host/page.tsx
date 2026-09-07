import { H1, Lead, H2, P, Code, Inline, DocTable, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "Self-hosting — Diagnost AI Docs" };

export default function SelfHostPage() {
  return (
    <div>
      <H1>Self-hosting</H1>
      <Lead>Your box, your data. One command on a VPS, or Terraform on AWS/GCP.</Lead>

      <H2>One-command VPS install</H2>
      <P>Ubuntu 22.04, 8 vCPU / 32 GB, ports 80+443, domain pointed at the box (~$40–80/mo):</P>
      <Code>{`git clone https://github.com/shashwat558/diagnost-ai /opt/diagnost-ai
cd /opt/diagnost-ai
bash tools/install.sh --domain agents.example.com --email owner@example.com`}</Code>
      <P>
        The installer generates <Inline>.env.prod</Inline>, builds, starts infra + api/consumer/
        notifier/dashboard + nightly retention + Caddy HTTPS, migrates, and prints your login,
        password and API key (shown once). Local test without TLS:{" "}
        <Inline>bash tools/install.sh --skip-tls --email owner@example.com --no-cron</Inline>.
      </P>

      <H2>Operate</H2>
      <Code>{`docker compose -p diagnost-ai-prod -f docker-compose.prod.yml --env-file .env.prod ps
curl -s https://agents.example.com/readyz | jq
docker compose -p diagnost-ai-prod -f docker-compose.prod.yml logs -f api`}</Code>
      <P>
        Upgrade: <Inline>git pull</Inline>, rebuild, <Inline>up -d --build --wait</Inline>, migrate.
        Retention runs daily automatically (Free 7d → Enterprise ∞); manual:{" "}
        <Inline>pnpm --filter @diagnost/db retention -- --dry-run</Inline>.
      </P>

      <H2>Backup & restore</H2>
      <Code>{`bash tools/backup/backup.sh ./backups/2026-09-04     # pg_dump + ClickHouse Native
bash tools/backup/restore.sh ./backups/2026-09-04    # drop + recreate + reload`}</Code>
      <P>
        A nightly cron is installed by the installer (03:00). Override the target stack with{" "}
        <Inline>COMPOSE_PROJECT_NAME</Inline> / <Inline>COMPOSE_FILE</Inline>.
      </P>

      <H2>Cloud (Terraform)</H2>
      <DocTable
        head={["Target", "What you get"]}
        rows={[
          ["infra/terraform/aws", "VPC, RDS Postgres 16, private S3 ×3, ECS Fargate ×5 services, ALB HTTPS, CloudWatch."],
          ["infra/terraform/gcp", "Single-VM profile + Cloud SQL + GCS + firewall (skeleton for small teams)."],
        ]}
      />
      <Code>{`cd infra/terraform/aws
terraform init && terraform plan -var="key_name=your-key"`}</Code>

      <H2>Troubleshooting</H2>
      <P>
        <Inline>readyz</Inline> 503 → check service logs; mismatched <Inline>POSTGRES_PASSWORD</Inline> vs{" "}
        <Inline>DATABASE_URL</Inline> is the classic. 402 on ingest → quota exhausted, upgrade in
        Settings. No cert → port 80 must be reachable for ACME. Wrong domain in links → rebuild the
        dashboard (<Inline>NEXT_PUBLIC_APP_URL</Inline> bakes at build time). SMTP silent → set a
        real <Inline>SMTP_URL</Inline> (MailHog is dev-only).
      </P>

      <PrevNext
        prev={{ href: "/docs/billing", label: "Plans & billing" }}
        next={{ href: "/docs/api-reference", label: "API reference" }}
      />
    </div>
  );
}
