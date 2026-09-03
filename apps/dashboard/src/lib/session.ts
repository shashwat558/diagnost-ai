import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@diagnost/db";

export const SESSION_COOKIE = "diagnost_session";

export const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://diagnost:diagnost_dev_password@localhost:5432/diagnost";

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return getSessionUser(DATABASE_URL, store.get(SESSION_COOKIE)?.value);
}

/** Server-component gate: redirect()s to /login when no valid session. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/** Role gate for admin-only pages (Settings, Audit). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (!["owner", "admin"].includes(user.role)) redirect("/dashboard");
  return user;
}
