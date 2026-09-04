/**
 * Alert notifier: polls undelivered alerts and fans out to configured
 * channels (Slack webhook, SMTP email).
 *
 * Guarantees: at-least-once via the alert_deliveries ledger; per-channel
 * rate limiting (one notification per cluster per window) inserts a
 * `skipped` row so the UI can show what was muted.
 */
import nodemailer from "nodemailer";
import { loadConfig, query } from "@diagnost/db";
import { randomUUID } from "node:crypto";

const RATE_LIMIT_MINUTES = 60;
const POLL_MS = 5_000;

interface PendingRow {
  id: string;
  cluster_id: string | null;
  type: string;
  severity: string;
  message: string;
  channel_id: string;
  channel: string;
  target: string;
}

async function pendingDeliveries(databaseUrl: string): Promise<PendingRow[]> {
  return query<PendingRow>(
    databaseUrl,
    `
    SELECT a.id, a.cluster_id, a.type, a.severity, a.message,
           c.id AS channel_id, c.channel, c.target
    FROM alerts a
    JOIN notification_channels c
      ON c.workspace_id = a.workspace_id AND c.enabled
    WHERE NOT EXISTS (
      SELECT 1 FROM alert_deliveries d
      WHERE d.alert_id = a.id AND d.channel_id = c.id
    )
    ORDER BY a.created_at
    LIMIT 50
    `
  );
}

async function recentlySent(
  databaseUrl: string,
  alert: PendingRow
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    databaseUrl,
    `
    SELECT d.id
    FROM alert_deliveries d
    JOIN alerts a ON a.id = d.alert_id
    WHERE d.channel_id = $1
      AND d.status = 'sent'
      AND a.cluster_id IS NOT DISTINCT FROM $2
      AND d.created_at > now() - ($3 || ' minutes')::interval
    LIMIT 1
    `,
    [alert.channel_id, alert.cluster_id, String(RATE_LIMIT_MINUTES)]
  );
  return rows.length > 0;
}

async function record(
  databaseUrl: string,
  alertId: string,
  channelId: string,
  status: "sent" | "failed" | "skipped",
  detail: string
): Promise<void> {
  await query(
    databaseUrl,
    `INSERT INTO alert_deliveries (id, alert_id, channel_id, status, detail, delivered_at)
     VALUES ($1,$2,$3,$4,$5, CASE WHEN $4='sent' THEN now() ELSE NULL END)`,
    [randomUUID(), alertId, channelId, status, detail]
  );
}

export function makeMailer(smtpUrl: string, from = "alerts@diagnost.local") {
  const transport = nodemailer.createTransport({ url: smtpUrl });
  return (to: string, subject: string, text: string) =>
    transport.sendMail({ from, to, subject, text });
}

export function makeSlackPoster() {
  return async (webhookUrl: string, payload: Record<string, unknown>) => {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`slack webhook ${res.status}`);
  };
}

export function formatAlert(
  alert: PendingRow,
  dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3100"
): { subject: string; text: string } {
  const dash = dashboardUrl.replace(/\/$/, "");
  const link = alert.cluster_id ? `${dash}/clusters/${alert.cluster_id}` : `${dash}/clusters`;
  return {
    subject: `[diagnost][${alert.severity}] ${alert.type}`,
    text: `${alert.message}\n\nDetails: ${link}`,
  };
}

export async function tickOnce(cfg = loadConfig()): Promise<number> {
  const mailer = makeMailer(cfg.smtpUrl, cfg.smtpFrom);
  const postSlack = makeSlackPoster();
  const pending = await pendingDeliveries(cfg.databaseUrl);
  let handled = 0;

  for (const alert of pending) {
    try {
      if (await recentlySent(cfg.databaseUrl, alert)) {
        await record(cfg.databaseUrl, alert.id, alert.channel_id, "skipped", "rate_limited");
        continue;
      }
      const { subject, text } = formatAlert(alert, cfg.dashboardUrl);
      if (alert.channel === "email") {
        await mailer(alert.target, subject, text);
        await record(cfg.databaseUrl, alert.id, alert.channel_id, "sent", `emailed ${alert.target}`);
      } else if (alert.channel === "slack") {
        await postSlack(alert.target, { text: `*${subject}*\n${text}` });
        await record(cfg.databaseUrl, alert.id, alert.channel_id, "sent", "posted to slack");
      }
      handled += 1;
      console.log(`[notifier] ${alert.channel} delivered for ${alert.id}`);
    } catch (err) {
      await record(
        cfg.databaseUrl,
        alert.id,
        alert.channel_id,
        "failed",
        String((err as Error).message ?? err).slice(0, 300)
      );
      console.error(`[notifier] delivery failed for ${alert.id}:`, err);
    }
  }
  return handled;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  console.log("[notifier] running");
  let stopped = false;
  const loop = async () => {
    while (!stopped) {
      try {
        await tickOnce(cfg);
      } catch (err) {
        console.error("[notifier] tick error:", err);
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  };
  process.on("SIGTERM", () => {
    stopped = true;
    process.exit(0);
  });
  process.on("SIGINT", () => {
    stopped = true;
    process.exit(0);
  });
  await loop();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("[notifier] fatal:", err);
    process.exit(1);
  });
}
