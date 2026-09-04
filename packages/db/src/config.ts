import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimal .env loader — never overrides real process env. */
function loadDotEnv(): void {
  const candidate = join(process.cwd(), ".env");
  if (!existsSync(candidate)) return;
  for (const line of readFileSync(candidate, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    if (!(key in process.env)) {
      process.env[key] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

export function int(env: string | undefined, fallback: number): number {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface Config {
  databaseUrl: string;
  clickhouseUrl: string;
  clickhouseUser: string;
  clickhousePassword: string;
  clickhouseDb: string;
  kafkaBrokers: string[];
  kafkaEventsTopic: string;
  s3Endpoint: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3BucketTranscripts: string;
  apiPort: number;
  smtpUrl: string;
  smtpFrom: string;
  dashboardUrl: string;
  workspaceId: string;
}

export function loadConfig(overrides: Partial<Record<keyof Config, unknown>> = {}): Config {
  loadDotEnv();
  const base: Config = {
    databaseUrl: process.env.DATABASE_URL ?? "postgres://diagnost:diagnost_dev_password@localhost:5432/diagnost",
    clickhouseUrl: process.env.CLICKHOUSE_URL ?? process.env.CLICKHOUSE_HTTP_URL ?? "http://localhost:8123",
    clickhouseUser: process.env.CLICKHOUSE_USER ?? "diagnost",
    clickhousePassword: process.env.CLICKHOUSE_PASSWORD ?? "diagnost_dev_password",
    clickhouseDb: process.env.CLICKHOUSE_DB ?? "events",
    kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
    kafkaEventsTopic: process.env.KAFKA_EVENTS_TOPIC ?? "events.raw",
    s3Endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    s3Region: process.env.S3_REGION ?? "us-east-1",
    s3AccessKey: process.env.S3_ACCESS_KEY ?? "minioadmin",
    s3SecretKey: process.env.S3_SECRET_KEY ?? "minioadmin_dev_password",
    s3BucketTranscripts: process.env.S3_BUCKET_TRANSCRIPTS ?? "transcripts",
    apiPort: int(process.env.API_PORT, 4100),
    smtpUrl: process.env.SMTP_URL ?? "smtp://localhost:1025",
    // Real providers work via URL auth, e.g. smtp://user:pass@smtp.resend.com:587
    // (STARTTLS on 587 is automatic; append ?secure=true for port 465 SMTPS).
    smtpFrom: process.env.SMTP_FROM ?? "alerts@diagnost.local",
    dashboardUrl:
      process.env.DASHBOARD_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100",
    workspaceId: process.env.WORKSPACE_ID ?? "ws_dev",
  };
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined)     (base as unknown as Record<string, unknown>)[k] = v;
  }
  return base;
}
