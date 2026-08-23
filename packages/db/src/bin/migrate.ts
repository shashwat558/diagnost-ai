import { loadConfig } from "../config.js";
import { migrateClickHouse, migratePostgres } from "../migrate.js";
import { closePool } from "../postgres.js";

async function main(): Promise<void> {
  const cfg = loadConfig();

  const appliedPg = await migratePostgres(cfg.databaseUrl);
  console.log(`[db] postgres migrations applied: ${appliedPg.join(", ") || "(none pending)"}`);

  const appliedCh = await migrateClickHouse({
    url: cfg.clickhouseUrl,
    username: cfg.clickhouseUser,
    password: cfg.clickhousePassword,
    database: cfg.clickhouseDb,
  });
  console.log(`[db] clickhouse migrations ensured: ${appliedCh.join(", ")}`);

  await closePool();
}

main().catch((err) => {
  console.error("[db] migration failed:", err);
  process.exit(1);
});
