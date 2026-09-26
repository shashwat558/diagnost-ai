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
/** Failed deliveries are retried until they exhaust this many attempts. */
const MAX_DELIVERY_ATTEMPTS = 5;
/** Backoff before retrying a failed delivery, so a broken channel is not hammered. */
const RETRY_BACKOFF_MINUTES = 5;

interface PendingRow {
  id: string;
  cluster_id: string | null;
  type: string;
  severity: string;
  message: string;
  channel_id: string;
  channel: string;
  target: string;
  attempts: number;
}

/**
 * Alerts still owing a delivery. `sent`/`skipped` are terminal; `failed` rows
 * stay eligible until MAX_DELIVERY_ATTEMPTS, spaced by RETRY_BACKOFF_MINUTES so
 * a misconfigured channel (bad SMTP host, dead webhook) cannot spin.
 */
async function pendingDeliveries(databaseUrl: string): Promise<PendingRow[]> {
  return query<PendingRow>(
    databaseUrl,
    `
    SELECT a.id, a.cluster_id, a.type, a.severity, a.message,
           c.id AS channel_id, c.channel, c.target,
           coalesce(d.attempts, 0) AS attempts
    FROM alerts a
    JOIN notification_channels c
      ON c.workspace_id = a.workspace_id AND c.enabled
    LEFT JOIN alert_deliveries d
      ON d.alert_id = a.id AND d.channel_id = c.id
    WHERE NOT EXISTS (
      SELECT 1 FROM alert_deliveries t
      WHERE t.alert_id = a.id AND t.channel_id = c.id
        AND t.status IN ('sent','skipped')
    )
      AND (d.id IS NULL OR (
        d.status = 'failed'
        AND d.attempts < $1
        AND d.last_attempt_at < now() - ($2 || ' minutes')::interval
      ))
    ORDER BY a.created_at
    LIMIT 50
    `,
    [String(MAX_DELIVERY_ATTEMPTS), String(RETRY_BACKOFF_MINUTES)]
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

/**
 * Writes the outcome to the at-least-once ledger. Upserts on
 * (alert_id, channel_id) — that pair is unique, so a retry updates the failed
 * row in place and bumps the attempt counter rather than inserting a duplicate.
 */
async function record(
  databaseUrl: string,
  alertId: string,
  channelId: string,
  status: "sent" | "failed" | "skipped",
  detail: string,
  isRetry: boolean
): Promise<void> {
  await query(
    databaseUrl,
    `INSERT INTO alert_deliveries (id, alert_id, channel_id, status, detail, delivered_at, attempts, last_attempt_at)
     VALUES ($1,$2,$3,$4,$5, CASE WHEN $4='sent' THEN now() ELSE NULL END, 1, now())
     ON CONFLICT (alert_id, channel_id) DO UPDATE
       SET status = EXCLUDED.status,
           detail = EXCLUDED.detail,
           delivered_at = EXCLUDED.delivered_at,
           attempts = alert_deliveries.attempts + CASE WHEN $6 THEN 1 ELSE 0 END,
           last_attempt_at = now()`,
    [randomUUID(), alertId, channelId, status, detail, isRetry ? "1" : "0"]
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
    // attempts > 0 means a previous delivery failed and this is a retry
    const isRetry = alert.attempts > 0;
    try {
      if (await recentlySent(cfg.databaseUrl, alert)) {
        await record(cfg.databaseUrl, alert.id, alert.channel_id, "skipped", "rate_limited", isRetry);
        continue;
      }
      const { subject, text } = formatAlert(alert, cfg.dashboardUrl);
      if (alert.channel === "email") {
        await mailer(alert.target, subject, text);
        await record(cfg.databaseUrl, alert.id, alert.channel_id, "sent", `emailed ${alert.target}`, isRetry);
      } else if (alert.channel === "slack") {
        await postSlack(alert.target, { text: `*${subject}*\n${text}` });
        await record(cfg.databaseUrl, alert.id, alert.channel_id, "sent", "posted to slack", isRetry);
      }
      handled += 1;
      console.log(
        `[notifier] ${alert.channel} delivered for ${alert.id}${isRetry ? ` (retry ${alert.attempts + 1})` : ""}`
      );
    } catch (err) {
      await record(
        cfg.databaseUrl,
        alert.id,
        alert.channel_id,
        "failed",
        String((err as Error).message ?? err).slice(0, 300),
        isRetry
      );
      const attempts = alert.attempts + 1;
      console.error(
        `[notifier] delivery failed for ${alert.id} (attempt ${attempts}/${MAX_DELIVERY_ATTEMPTS}):`,
        err
      );
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
