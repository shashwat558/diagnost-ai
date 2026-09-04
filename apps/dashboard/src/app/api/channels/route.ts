import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/session";
import { pgQuery } from "@/lib/pg";
import { validateChannel } from "@/lib/channels";

export interface ChannelRow {
  id: string;
  channel: string;
  target: string;
  enabled: boolean;
  created_at: string;
}

function forbidden(user: { role: string } | null) {
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!["owner", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getSession();
  const denied = forbidden(session);
  if (denied) return denied;
  const rows = await pgQuery<ChannelRow>(
    `SELECT id, channel, target, enabled, created_at FROM notification_channels
     WHERE workspace_id=$1 ORDER BY created_at`,
    [session!.workspaceId]
  );
  // mask slack secrets: show prefix only
  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      target: r.channel === "slack" ? `${r.target.slice(0, 32)}…` : r.target,
    }))
  );
}

export async function POST(req: Request) {
  const session = await getSession();
  const denied = forbidden(session);
  if (denied) return denied;
  let body: { channel?: string; target?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const err = validateChannel(body.channel ?? "", body.target ?? "");
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const channel = body.channel!;
  const target = body.target!.trim();
  try {
    const rows = await pgQuery<ChannelRow>(
      `INSERT INTO notification_channels (id, workspace_id, channel, target)
       VALUES ($1,$2,$3,$4) RETURNING id, channel, target, enabled, created_at`,
      [randomUUID(), session!.workspaceId, channel, target]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "channel already exists" }, { status: 409 });
  }
}
