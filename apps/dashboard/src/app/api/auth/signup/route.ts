import { NextResponse } from "next/server";
import {
  createUserWorkspace,
  createSession,
  recordAudit,
} from "@diagnost/db";
import { DATABASE_URL, SESSION_COOKIE } from "@/lib/session";

const SESSION_MAX_AGE = 30 * 86_400; // seconds

export async function POST(req: Request) {
  let body: { email?: string; password?: string; workspaceName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { email, password, workspaceName } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const result = await createUserWorkspace(DATABASE_URL, {
      email,
      password,
      workspaceName,
    });
    const session = await createSession(DATABASE_URL, result.userId);
    await recordAudit(DATABASE_URL, {
      workspaceId: result.workspaceId,
      actor: result.email,
      action: "workspace.created",
      target: result.workspaceId,
    });
    const res = NextResponse.json(
      {
        ok: true,
        workspaceId: result.workspaceId,
        apiKey: result.apiKey, // shown once at signup
        email: result.email,
      },
      { status: 201 }
    );
    res.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    const code = err instanceof Error ? err.message : "signup_failed";
    const status =
      code === "email_taken" || code === "invalid_email" || code === "weak_password"
        ? 400
        : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
