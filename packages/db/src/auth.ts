import { createHash, randomBytes, randomUUID, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getPool } from "./postgres.js";
import { generateApiKey } from "./s3.js";
import type { Role } from "./governance.js";

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;
const SESSION_TTL_DAYS = 30;

/** Hash format: scrypt$<salthex>$<hashhex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export interface SessionUser {
  userId: string;
  email: string;
  role: Role;
  workspaceId: string;
  workspaceName: string;
  plan: string;
  sessionExpiresAt: Date;
}

export async function createSession(
  databaseUrl: string,
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await getPool(databaseUrl).query(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)",
    [randomUUID(), userId, tokenHash, expiresAt]
  );
  return { token, expiresAt };
}

export async function getSessionUser(
  databaseUrl: string,
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const res = await getPool(databaseUrl).query(
    `SELECT u.id AS user_id, u.email, u.role::text AS role,
            w.id AS workspace_id, w.name AS workspace_name, w.plan,
            s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN workspaces w ON w.id = u.workspace_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    userId: r.user_id,
    email: r.email ?? "",
    role: r.role as Role,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name,
    plan: r.plan,
    sessionExpiresAt: new Date(r.expires_at),
  };
}

export async function destroySession(databaseUrl: string, token: string | undefined): Promise<void> {
  if (!token) return;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await getPool(databaseUrl).query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

export interface SignupResult {
  userId: string;
  workspaceId: string;
  apiKey: string; // raw key — shown once at signup
  email: string;
  workspaceName: string;
}

/** Creates a workspace + owner user + API key in one transaction. */
export async function createUserWorkspace(
  databaseUrl: string,
  input: { email: string; password: string; workspaceName?: string }
): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid_email");
  if (input.password.length < 8) throw new Error("weak_password");

  const passwordHash = await hashPassword(input.password);
  const workspaceId = `ws_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const key = generateApiKey();
  const client = await getPool(databaseUrl).connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT 1 FROM users WHERE email=$1", [email]);
    if (existing.rowCount && existing.rowCount > 0) throw new Error("email_taken");
    const wsName =
      input.workspaceName?.trim() || `${email.split("@")[0]}'s workspace`;
    await client.query("INSERT INTO workspaces (id, name) VALUES ($1,$2)", [workspaceId, wsName]);
    const userId = `user_${randomUUID().replace(/-/g, "")}`;
    await client.query(
      "INSERT INTO users (id, workspace_id, email, password_hash, role) VALUES ($1,$2,$3,$4,'owner')",
      [userId, workspaceId, email, passwordHash]
    );
    await client.query(
      "INSERT INTO api_keys (id, workspace_id, key_hash, prefix) VALUES ($1,$2,$3,$4)",
      [`key_${randomUUID().replace(/-/g, "").slice(0, 12)}`, workspaceId, key.hash, key.prefix]
    );
    await client.query("COMMIT");
    return { userId, workspaceId, apiKey: key.raw, email, workspaceName: wsName };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function loginUser(
  databaseUrl: string,
  email: string,
  password: string
): Promise<{ token: string; expiresAt: Date; user: SessionUser } | null> {
  const res = await getPool(databaseUrl).query(
    `SELECT u.id, u.password_hash FROM users u WHERE u.email = $1`,
    [email.trim().toLowerCase()]
  );
  if (res.rows.length === 0 || !res.rows[0].password_hash) return null;
  const ok = await verifyPassword(password, res.rows[0].password_hash);
  if (!ok) return null;
  const { token, expiresAt } = await createSession(databaseUrl, res.rows[0].id);
  const user = await getSessionUser(databaseUrl, token);
  if (!user) return null;
  return { token, expiresAt, user };
}
