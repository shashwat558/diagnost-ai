import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type QueryResultRow } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(__dirname, "migrations");

let pool: Pool | null = null;

export function getPool(databaseUrl: string): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl, max: 10 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function query<T extends QueryResultRow>(
  databaseUrl: string,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const p = getPool(databaseUrl);
  const res = await p.query<T>(sql, params);
  return res.rows;
}

export function loadMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}
