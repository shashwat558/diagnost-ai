import { NextResponse } from "next/server";
import { destroySession } from "@diagnost/db";
import { DATABASE_URL, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  try {
    await destroySession(DATABASE_URL, token);
  } catch {
    // session row may already be gone — clearing the cookie is what matters
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
