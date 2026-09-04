import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/session";
import { pgQuery } from "@/lib/pg";
import { recordAudit } from "@diagnost/db";
import { DATABASE_URL } from "@/lib/session";

export interface InstructionRow {
  id: string;
  name: string;
  handles_intent: string;
  current_version: string;
  created_at: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const rows = await pgQuery<InstructionRow>(
    `SELECT id, name, handles_intent, current_version, created_at FROM artifacts
     WHERE workspace_id=$1 AND kind='prompt' ORDER BY created_at DESC`,
    [session.workspaceId]
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { name?: string; handles_intent?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const handlesIntent = (body.handles_intent ?? "").trim();
  const content = (body.content ?? "").trim();

  if (!name || name.length > 80) {
    return NextResponse.json({ error: "name must be 1–80 characters" }, { status: 400 });
  }
  if (!/^[a-z0-9_]+$/.test(handlesIntent)) {
    return NextResponse.json(
      { error: "handles_intent must be a snake_case intent id" },
      { status: 400 }
    );
  }
  if (content.length < 10 || content.length > 10_000) {
    return NextResponse.json({ error: "content must be 10–10000 characters" }, { status: 400 });
  }

  const artifactId = `art_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  try {
    await pgQuery(
      `INSERT INTO artifacts (id, workspace_id, kind, name, handles_intent, current_version)
       VALUES ($1,$2,'prompt',$3,$4,'v1')`,
      [artifactId, session.workspaceId, name, handlesIntent]
    );
    await pgQuery(
      `INSERT INTO artifact_versions (id, artifact_id, version, content)
       VALUES ($1,$2,'v1',$3)`,
      [`artv_${randomUUID().replace(/-/g, "").slice(0, 12)}`, artifactId, content]
    );
  } catch {
    return NextResponse.json({ error: "an instruction with this name already exists" }, { status: 409 });
  }

  await recordAudit(DATABASE_URL, {
    workspaceId: session.workspaceId,
    actor: session.email,
    action: "artifact.created",
    target: artifactId,
    metadata: { name, handles_intent: handlesIntent, version: "v1" },
  });

  return NextResponse.json(
    { id: artifactId, name, handles_intent: handlesIntent, current_version: "v1" },
    { status: 201 }
  );
}
