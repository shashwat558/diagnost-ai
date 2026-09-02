import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({
    email: user.email,
    role: user.role,
    workspaceId: user.workspaceId,
    workspaceName: user.workspaceName,
    plan: user.plan,
  });
}
