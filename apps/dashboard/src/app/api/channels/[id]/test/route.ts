import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSession } from "@/lib/session";
import { pgQuery } from "@/lib/pg";

const SMTP_URL = process.env.SMTP_URL ?? "smtp://localhost:1025";
const SMTP_FROM = process.env.SMTP_FROM ?? "alerts@diagnost.local";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3100";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!["owner", "admin"].includes(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const rows = await pgQuery<{ channel: string; target: string; enabled: boolean }>(
    `SELECT channel, target, enabled FROM notification_channels
     WHERE id=$1 AND workspace_id=$2`,
    [id, session.workspaceId]
  );
  const ch = rows[0];
  if (!ch) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const subject = "[diagnost] test notification";
  const text = `This is a test alert from Diagnost AI (${session.workspaceName}).\n\nIf you received this, alert delivery is working.\nDashboard: ${APP_URL}/clusters`;

  try {
    if (ch.channel === "email") {
      const transport = nodemailer.createTransport({ url: SMTP_URL });
      await transport.sendMail({ from: SMTP_FROM, to: ch.target, subject, text });
    } else {
      const res = await fetch(ch.target, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `*${subject}*\n${text}` }),
      });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
    }
    return NextResponse.json({ ok: true, channel: ch.channel });
  } catch (err) {
    return NextResponse.json(
      { error: `delivery failed: ${String((err as Error).message ?? err).slice(0, 200)}` },
      { status: 502 }
    );
  }
}
