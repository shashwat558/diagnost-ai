import { NextResponse } from "next/server";
import { loginUser } from "@diagnost/db";
import { DATABASE_URL, SESSION_COOKIE } from "@/lib/session";

const SESSION_MAX_AGE = 30 * 86_400; // seconds

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const result = await loginUser(DATABASE_URL, email, password);
    if (!result) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    const res = NextResponse.json({
      ok: true,
      user: {
        email: result.user.email,
        role: result.user.role,
        workspaceId: result.user.workspaceId,
      },
    });
    res.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "login_failed" }, { status: 500 });
  }
}
