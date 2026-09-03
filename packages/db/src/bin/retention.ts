import { loadConfig, createClickhouse } from "../index.js";
import { enforceRetention } from "../retention.js";
import { closePool } from "../postgres.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const dryRun = process.argv.includes("--dry-run");
  const ch = createClickhouse({
    url: cfg.clickhouseUrl,
    username: cfg.clickhouseUser,
    password: cfg.clickhousePassword,
    database: cfg.clickhouseDb,
  });

  console.log(`[retention] starting${dryRun ? " (dry-run)" : ""} — per-plan TTL enforcement`);
  const results = await enforceRetention({
    databaseUrl: cfg.databaseUrl,
    clickhouse: ch,
    clickhouseDb: cfg.clickhouseDb,
    dryRun,
  });

  for (const r of results) {
    console.log(
      `[retention] ws=${r.workspaceId} plan=${r.plan} retention=${r.retentionDays}d cutoff=${r.cutoff} sessions_purged=${r.deletedSessions}`
    );
  }

  await ch.close();
  await closePool();
  console.log(`[retention] done — ${results.length} workspaces`);
}

main().catch((err) => {
  console.error("[retention] failed:", err);
  process.exit(1);
});
