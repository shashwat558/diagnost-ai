/**
 * Patch generation for failure clusters tied to prompt artifacts.
 *
 * Offline path is a deterministic repair: when the base prompt renders dates
 * without validation and the cluster intent is date_format_error, insert an
 * explicit validation directive. The OpenAI path asks a model to rewrite the
 * artifact given the same failure evidence.
 */
import type { AgentSimulator } from "./simulate.js";

export const VALIDATION_DIRECTIVE = [
  "",
  "## Date validation (required)",
  "Before rendering any date, validate it: the month must be 1-12 and the day",
  "must exist in that month. If the date is impossible (e.g. month 13), do NOT",
  "confirm the booking — apologize and ask the customer to double-check.",
].join("\n");

export interface PatchResult {
  proposedContent: string;
  generatorMode: "mock" | "openai";
  rationale: string;
}

export function offlinePatch(baseContent: string): PatchResult | null {
  if (!/YYYY[- ]?MM[- ]?DD/i.test(baseContent)) return null;
  if (/## Date validation/.test(baseContent)) return null; // already patched
  return {
    proposedContent: baseContent + VALIDATION_DIRECTIVE,
    generatorMode: "mock",
    rationale:
      "Base prompt renders YYYY-MM-DD without sanity checks; inserted explicit " +
      "month/day validation directive derived from invalid-date evidence in the cluster.",
  };
}

export async function openaiPatch(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  baseContent: string;
  failureEvidence: string[];
  simulator?: AgentSimulator;
}): Promise<PatchResult> {
  const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You fix AI-agent prompts from production failure evidence. Return ONLY the " +
            "full corrected prompt text, no commentary.",
        },
        {
          role: "user",
          content:
            `Current prompt:\n\n${opts.baseContent}\n\n` +
            `Failure evidence (agent outputs that were wrong):\n${opts.failureEvidence.slice(0, 10).map((e) => `- ${e}`).join("\n")}\n\n` +
            "Rewrite the prompt to fix these failures while preserving all other behavior.",
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message.content ?? "";
  if (!content.trim()) throw new Error("empty patch from model");
  return {
    proposedContent: content,
    generatorMode: "openai",
    rationale: "Model-rewritten prompt conditioned on failing outputs.",
  };
}

/** Unified diff for the PR body. */
export async function unifiedDiff(base: string, proposed: string, fileLabel: string): Promise<string> {
  const { createTwoFilesPatch } = await import("diff");
  return createTwoFilesPatch(
    `${fileLabel}@base`,
    `${fileLabel}@proposed`,
    base,
    proposed,
    undefined,
    undefined,
    { context: 2 }
  );
}
