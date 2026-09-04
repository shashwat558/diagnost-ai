import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pgQuery } from "@/lib/pg";

function denied(user: { role: string } | null) {
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!["owner", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const d = denied(session);
  if (d) return d;
  const { id } = await params;
  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }
  const rows = await pgQuery<{ id: string; enabled: boolean }>(
    `UPDATE notification_channels SET enabled=$1
     WHERE id=$2 AND workspace_id=$3 RETURNING id, enabled`,
    [body.enabled, id, session!.workspaceId]
  );
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const d = denied(session);
  if (d) return d;
  const { id } = await params;
  const rows = await pgQuery<{ id: string }>(
    `DELETE FROM notification_channels WHERE id=$1 AND workspace_id=$2 RETURNING id`,
    [id, session!.workspaceId]
  );
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
