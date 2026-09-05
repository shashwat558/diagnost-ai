import { Pool } from "pg";

let pool: Pool | null = null;

function p(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        "postgres://diagnost:diagnost_dev_password@localhost:5434/diagnost",
      max: 5,
    });
  }
  return pool;
}

export async function pgQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await p().query(sql, params);
  return res.rows as T[];
}
