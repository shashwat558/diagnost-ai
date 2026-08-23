import { createClient, type ClickHouseClient } from "@clickhouse/client";

let client: ClickHouseClient | null = null;

function ch(): ClickHouseClient {
  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL ?? process.env.CLICKHOUSE_HTTP_URL ?? "http://localhost:8123",
      username: process.env.CLICKHOUSE_USER ?? "diagnost",
      password: process.env.CLICKHOUSE_PASSWORD ?? "diagnost_dev_password",
      database: process.env.CLICKHOUSE_DB ?? "events",
    });
  }
  return client;
}

export async function chQuery<T>(sql: string): Promise<T[]> {
  const res = await ch().query({ query: sql, format: "JSONEachRow" });
  return (await res.json()) as T[];
}

export async function chQueryParams<T>(
  sql: string,
  params: Record<string, unknown>
): Promise<T[]> {
  const res = await ch().query({ query: sql, format: "JSONEachRow", query_params: params });
  return (await res.json()) as T[];
}
