/**
 * Auto-remediation CLI.
 *
 *   node dist/main.js --cluster <id> [--dry-run]
 *
 * Pipeline:
 *   failure cluster → matched artifact → candidate patch → auto-generated eval
 *   cases (from failing conversations) + held-out regression set (previously-
 *   passing conversations) → gate (improvement, zero regressions) → PR with
 *   diff + eval report + source-conversation links.
 */
import { randomUUID } from "node:crypto";
import { loadConfig, createClickhouse, query, recordAudit } from "@diagnost/db";
import { fetchConversationTexts, buildCaseBundle } from "./cases.js";
import { makeSimulator } from "./simulate.js";
import { offlinePatch, openaiPatch, unifiedDiff } from "./patch.js";
import { runEval, gate, renderReportMarkdown, type EvalReport } from "./eval.js";
import { openPullRequest } from "./github.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const clusterId = arg("cluster");
  if (!clusterId) {
    console.error("usage: --cluster <cluster_id> [--dry-run]");
    process.exit(2);
  }
  const dryRun = process.argv.includes("--dry-run");
  const cfg = loadConfig();

  // ── cluster + artifact resolution ────────────────────────────────
  const clusterRows = await query<{ id: string; intent: string }>(
    cfg.databaseUrl,
    "SELECT id, intent FROM clusters WHERE id = $1",
    [clusterId]
  );
  if (clusterRows.length === 0) throw new Error(`cluster ${clusterId} not found`);
  const cluster = clusterRows[0]!;

  const artifactRows = await query<{
    id: string;
    name: string;
    current_version: string;
    base_content: string;
  }>(
    cfg.databaseUrl,
    `
    SELECT a.id, a.name, a.current_version, v.content AS base_content
    FROM artifacts a
    JOIN artifact_versions v ON v.artifact_id = a.id AND v.version = a.current_version
    WHERE a.workspace_id = $1 AND a.handles_intent = $2
    ORDER BY a.created_at DESC LIMIT 1
    `,
    [cfg.workspaceId, cluster.intent]
  );
  if (artifactRows.length === 0) {
    throw new Error(
      `no artifact registered for intent '${cluster.intent}' — register one first`
    );
  }
  const artifact = artifactRows[0]!;
  console.log(`[remediate] cluster=${cluster.id} intent=${cluster.intent} artifact=${artifact.name}@${artifact.current_version}`);

  // ── evidence: failing vs previously-passing conversations ───────
  const members = await query<{ conversation_id: string; has_error: boolean }>(
    cfg.databaseUrl,
    "SELECT conversation_id, has_error FROM cluster_members WHERE cluster_id = $1",
    [clusterId]
  );
  const failingIds = members.filter((m) => m.has_error).map((m) => m.conversation_id);

  // held-out regression set: same-intent conversations that previously passed
  // (they may live in the same cluster — they never influence patch generation,
  // only verify no regressions)
  const heldOutCandidates = await query<{ conversation_id: string }>(
    cfg.databaseUrl,
    `
    SELECT DISTINCT cm.conversation_id
    FROM cluster_members cm
    JOIN clusters c ON c.id = cm.cluster_id
    WHERE c.workspace_id = $1 AND c.intent = $2 AND cm.has_error = FALSE
    LIMIT 20
    `,
    [cfg.workspaceId, cluster.intent]
  );
  console.log(`[remediate] evidence: ${failingIds.length} failing, ${heldOutCandidates.length} held-out candidates`);

  const ch = createClickhouse({
    url: cfg.clickhouseUrl,
    username: cfg.clickhouseUser,
    password: cfg.clickhousePassword,
    database: cfg.clickhouseDb,
  });
  const failingTexts = await fetchConversationTexts(ch, cfg.clickhouseDb, failingIds);
  const heldOutTexts = await fetchConversationTexts(
    ch,
    cfg.clickhouseDb,
    heldOutCandidates.map((r) => r.conversation_id)
  );
  await ch.close();

  const bundle = buildCaseBundle(failingTexts, heldOutTexts);
  console.log(`[remediate] eval cases: ${bundle.target.length} target, ${bundle.heldOut.length} held-out`);

  // ── patch generation ─────────────────────────────────────────────
  let patch;
  if (process.env.LLM_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    patch = await openaiPatch({
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.LLM_MODEL ?? "gpt-4o-mini",
      baseContent: artifact.base_content,
      failureEvidence: failingTexts.map((f) => f.text.slice(0, 200)),
    });
  } else {
    const offline = offlinePatch(artifact.base_content);
    if (!offline) throw new Error("offline generator produced no patch for this artifact shape");
    patch = offline;
  }
  console.log(`[remediate] patch generated (${patch.generatorMode})`);

  // ── evaluation + gate ────────────────────────────────────────────
  const simulator = makeSimulator({
    provider: process.env.LLM_PROVIDER,
    baseUrl: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.LLM_MODEL,
  });

  const baselineResults = await runEval(simulator, artifact.base_content, bundle.target);
  const patchedResults = await runEval(simulator, patch.proposedContent, bundle.target);
  const heldBaseline = await runEval(simulator, artifact.base_content, bundle.heldOut);
  const heldPatched = await runEval(simulator, patch.proposedContent, bundle.heldOut);

  const verdict = gate({
    baselineResults,
    patchedResults,
    heldOutBaseline: heldBaseline,
    heldOutPatched: heldPatched,
  });

  const rate = (rs: { pass: boolean }[]) =>
    rs.length ? rs.filter((r) => r.pass).length / rs.length : 0;
  const report: EvalReport = {
    baseline: { passRate: rate(baselineResults), results: baselineResults },
    patched: { passRate: rate(patchedResults), results: patchedResults },
    heldOut: {
      baselinePassRate: rate(heldBaseline),
      patchedPassRate: rate(heldPatched),
      regressions: [],
      size: bundle.heldOut.length,
    },
    gate: verdict,
  };
  // fill regression details
  for (let i = 0; i < heldPatched.length; i++) {
    const before = heldBaseline[i];
    const after = heldPatched[i]!;
    if (before?.pass && !after.pass) {
      report.heldOut.regressions.push({ caseId: after.caseId, input: after.response.slice(0, 120) });
    }
  }

  const status = verdict.passed ? "passed" : "failed_gate";
  console.log(`[remediate] baseline ${(report.baseline.passRate * 100).toFixed(0)}% → patched ${(report.patched.passRate * 100).toFixed(0)}%; regressions=${report.heldOut.regressions.length}; gate=${status}`);

  // ── persist remediation record ───────────────────────────────────
  const remediationId = `rm_${randomUUID().slice(0, 12)}`;
  const proposedVersion = `${artifact.current_version}-fix-${new Date().toISOString().slice(0, 10)}`;
  await query(
    cfg.databaseUrl,
    `
    INSERT INTO remediations (id, workspace_id, cluster_id, artifact_id, base_version,
                              proposed_version, status, eval_report)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      remediationId,
      cfg.workspaceId,
      clusterId,
      artifact.id,
      artifact.current_version,
      proposedVersion,
      status,
      JSON.stringify(report),
    ]
  );

  // persist the proposed version so humans can inspect/promote it
  await query(
    cfg.databaseUrl,
    `
    INSERT INTO artifact_versions (id, artifact_id, version, content)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT DO NOTHING
    `,
    [`av_${randomUUID().slice(0, 12)}`, artifact.id, proposedVersion, patch.proposedContent]
  );

  // ── open PR when gated in ────────────────────────────────────────
  if (!verdict.passed || dryRun) {
    console.log(`[remediate] stopping (gate=${verdict.passed}, dryRun=${dryRun})`);
    return;
  }

  const diff = await unifiedDiff(artifact.base_content, patch.proposedContent, artifact.name);
  const sources = [
    ...new Set(bundle.target.map((c) => c.sourceConversationId).filter(Boolean)),
  ] as string[];
  const prBody = [
    renderReportMarkdown(report, {
      clusterIntent: cluster.intent,
      artifactName: artifact.name,
      baseVersion: artifact.current_version,
      proposedVersion,
    }),
    "",
    "### Source conversations (failure evidence)",
    ...(sources.length ? sources.map((s) => `- \`${s}\``) : ["- _(canonical probes only)_"]),
    "",
    "```diff",
    diff,
    "```",
  ].join("\n");

  const pr = await openPullRequest({
    artifactName: artifact.name,
    baseContent: artifact.base_content,
    proposedContent: patch.proposedContent,
    branch: `diagnost-fix/${cluster.intent}-${remediationId.slice(-6)}`,
    prTitle: `[diagnost] fix ${cluster.intent}: update ${artifact.name}`,
    prBody,
  });
  console.log(`[remediate] PR opened (${pr.mode}): ${pr.url}`);

  await recordAudit(cfg.databaseUrl, {
    workspaceId: cfg.workspaceId,
    actor: "system:pr-bot",
    action: "remediation.pr_opened",
    target: remediationId,
    metadata: { cluster: clusterId, intent: cluster.intent, url: pr.url, branch: pr.branch },
  });

  await query(
    cfg.databaseUrl,
    "UPDATE remediations SET status='pr_opened', pr_url=$2, pr_branch=$3 WHERE id=$1",
    [remediationId, pr.url, pr.branch]
  );

  console.log(JSON.stringify({ remediationId, status: "pr_opened", url: pr.url }, null, 2));
}

main().catch((err) => {
  console.error("[remediate] failed:", err);
  process.exit(1);
});
