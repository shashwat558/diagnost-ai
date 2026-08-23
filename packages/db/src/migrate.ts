import { readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@clickhouse/client";
import {
  getPool,
  loadMigration,
  MIGRATIONS_DIR,
} from "./postgres.js";

export async function migratePostgres(databaseUrl: string): Promise<string[]> {
  await getPool(databaseUrl).query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await getPool(databaseUrl).query<{ name: string }>(
    "SELECT name FROM schema_migrations"
  );
  const applied = new Set(rows.map((r) => r.name));

  const files = readdirSync(join(MIGRATIONS_DIR, "postgres"))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = loadMigration(join("postgres", file));
    const p = getPool(databaseUrl);
    const client = await p.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  return files.filter((f) => !applied.has(f));
}

export async function migrateClickHouse(opts: {
  url: string;
  username: string;
  password: string;
  database: string;
}): Promise<string[]> {
  const client = createClient({
    url: opts.url,
    username: opts.username,
    password: opts.password,
    database: opts.database,
  });

  const files = readdirSync(join(MIGRATIONS_DIR, "clickhouse"))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  try {
    for (const file of files) {
      const sql = loadMigration(join("clickhouse", file)).replaceAll("{db}", opts.database);
      // strip -- comments first: they may contain ';' and would split incorrectly
      const statements = sql
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await client.command({ query: stmt });
      }
    }
  } finally {
    await client.close();
  }
  return files;
}
