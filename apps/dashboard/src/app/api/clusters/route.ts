import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getIntentRows } from "@/lib/intents";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const rows = await getIntentRows(session.workspaceId);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: "failed", details: String(err) }, { status: 500 });
  }
}
