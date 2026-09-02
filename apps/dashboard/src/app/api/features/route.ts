import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pgQuery } from "@/lib/pg";

interface Row {
  slug: string;
  frequency: number;
  description: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const rows = await pgQuery<Row>(
    `SELECT slug, frequency, description FROM feature_requests
     WHERE workspace_id=$1 ORDER BY frequency DESC LIMIT 50`,
    [session.workspaceId]
  );
  return NextResponse.json(rows);
}
