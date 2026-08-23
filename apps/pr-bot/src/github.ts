/**
 * GitHub adapter, dual-mode:
 *
 *  - "github": real API via fine-grained PAT (GITHUB_TOKEN + GITHUB_REPO=owner/name).
 *    Creates a branch from the default branch, commits the patched artifact,
 *    opens a PR whose body embeds the unified diff + eval report.
 *  - "fixture" (default offline): a local bare git repo stands in for GitHub.
 *    Same branch/commit semantics; returns fixture:// URLs so the whole
 *    pipeline runs without network access or tokens.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface PullRequestResult {
  mode: "github" | "fixture";
  url: string;
  branch: string;
  diff: string;
}

export function fixtureRepoPath(): string {
  return process.env.FIXTURE_REPO ?? "/tmp/diagnost-fixture-repo";
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
}

/** Ensures a working repo exists with the artifact committed on main. */
export function ensureFixtureRepo(filePathRel: string, baseContent: string): string {
  const repo = fixtureRepoPath();
  if (!existsSync(repo)) {
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-b", "main");
    git(repo, "config", "user.email", "pr-bot@diagnost.local");
    git(repo, "config", "user.name", "diagnost pr-bot");
  }
  const abs = join(repo, filePathRel);
  if (!existsSync(abs)) {
    mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
    writeFileSync(abs, baseContent);
    git(repo, "add", ".");
    git(repo, "commit", "-m", `seed artifact ${filePathRel}`);
  }
  return repo;
}

async function githubMode(opts: {
  repo: string;
  token: string;
  branch: string;
  filePathRel: string;
  proposedContent: string;
  prTitle: string;
  prBody: string;
}): Promise<PullRequestResult> {
  const api = `https://api.github.com/repos/${opts.repo}`;
  const headers = {
    authorization: `Bearer ${opts.token}`,
    accept: "application/vnd.github+json",
    "content-type": "application/json",
  };

  const refRes = await fetch(`${api}/git/ref/heads/main`, { headers });
  if (!refRes.ok) throw new Error(`cannot read main ref: ${refRes.status}`);
  const ref = (await refRes.json()) as { object: { sha: string } };

  await fetch(`${api}/git/refs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ref: `refs/heads/${opts.branch}`, sha: ref.object.sha }),
  }).then(async (r) => {
    if (!r.ok && !(await r.text()).includes("Reference already exists")) {
      throw new Error(`branch create failed: ${r.status}`);
    }
  });

  const baseFile = await fetch(`${api}/contents/${opts.filePathRel}?ref=main`, { headers });
  const sha = baseFile.ok ? ((await baseFile.json()) as { sha: string }).sha : undefined;

  const put = await fetch(`${api}/contents/${opts.filePathRel}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: opts.prTitle,
      content: Buffer.from(opts.proposedContent).toString("base64"),
      branch: opts.branch,
      sha,
    }),
  });
  if (!put.ok) throw new Error(`file commit failed: ${put.status} ${await put.text()}`);

  const pr = await fetch(`${api}/pulls`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: opts.prTitle,
      body: opts.prBody,
      head: opts.branch,
      base: "main",
    }),
  });
  if (!pr.ok) throw new Error(`PR create failed: ${pr.status} ${await pr.text()}`);
  const data = (await pr.json()) as { html_url: string };

  // best-effort diff for the report
  let diff = "";
  try {
    const dr = await fetch(`${api}/compare/main...${opts.branch}`, { headers });
    if (dr.ok) diff = String(((await dr.json()) as { files?: Array<{ patch?: string }> }).files?.[0]?.patch ?? "");
  } catch {
    /* non-fatal */
  }

  return { mode: "github", url: data.html_url, branch: opts.branch, diff };
}

export async function openPullRequest(opts: {
  artifactName: string;
  baseContent: string;
  proposedContent: string;
  branch: string;
  prTitle: string;
  prBody: string;
}): Promise<PullRequestResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (token && repo) {
    return githubMode({
      repo,
      token,
      branch: opts.branch,
      filePathRel: `artifacts/${opts.artifactName}`,
      proposedContent: opts.proposedContent,
      prTitle: opts.prTitle,
      prBody: opts.prBody,
    });
  }

  // fixture mode
  const repoPath = ensureFixtureRepo(`artifacts/${opts.artifactName}`, opts.baseContent);
  // refresh main in case base content drifted
  writeFileSync(join(repoPath, `artifacts/${opts.artifactName}`), opts.baseContent);
  git(repoPath, "add", ".");
  try {
    git(repoPath, "commit", "-m", "sync base artifact");
  } catch {
    /* nothing to commit */
  }

  const branches = git(repoPath, "branch", "--list", opts.branch);
  if (branches) git(repoPath, "branch", "-D", opts.branch);
  git(repoPath, "checkout", "-b", opts.branch);
  const abs = join(repoPath, `artifacts/${opts.artifactName}`);
  writeFileSync(abs, opts.proposedContent);
  git(repoPath, "add", ".");
  git(repoPath, "commit", "-m", opts.prTitle);

  const diff = git(repoPath, "diff", `main...${opts.branch}`);

  // persist the PR payload where CI can inspect it
  const prDir = join(repoPath, "..", "diagnost-pr-outbox");
  mkdirSync(prDir, { recursive: true });
  writeFileSync(
    join(prDir, `${opts.branch.replace(/\//g, "_")}.md`),
    `# ${opts.prTitle}\n\nBranch: ${opts.branch}\n\n${opts.prBody}\n\n\`\`\`diff\n${diff}\n\`\`\`\n`
  );

  git(repoPath, "checkout", "main");
  return { mode: "fixture", url: `fixture://${repoPath}/${opts.branch}`, branch: opts.branch, diff };
}

/** Used by acceptance to verify the fixture branch content. */
export function readFixtureBranchFile(branch: string, filePathRel: string): string | null {
  const repo = fixtureRepoPath();
  if (!existsSync(repo)) return null;
  try {
    return execFileSync("git", ["-C", repo, "show", `${branch}:${filePathRel}`], { encoding: "utf8" });
  } catch {
    return null;
  }
}
