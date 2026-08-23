import { createHash } from "node:crypto";
import { loadConfig } from "../config.js";
import { closePool, query } from "../postgres.js";

/** Deterministic local dev API key so tooling can rely on it. */
export const DEV_API_KEY = "dw_local_devkey_diagnost_00000000";

/**
 * Creates the local dev workspace + API key (idempotent).
 */
async function main(): Promise<void> {
  const cfg = loadConfig();

  await query(cfg.databaseUrl, `
    INSERT INTO workspaces (id, name, plan)
    VALUES ('ws_dev', 'Dev Workspace', 'free')
    ON CONFLICT (id) DO NOTHING
  `);

  const hash = createHash("sha256").update(DEV_API_KEY).digest("hex");
  await query(
    cfg.databaseUrl,
    `INSERT INTO api_keys (id, workspace_id, key_hash, prefix)
     VALUES ('ak_dev', 'ws_dev', $1, 'dw_local')
     ON CONFLICT (id) DO UPDATE SET key_hash = EXCLUDED.key_hash`,
    [hash]
  );

  console.log("[seed] dev workspace ready: ws_dev");
  console.log(`[seed] api key: ${DEV_API_KEY}`);
  await closePool();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
