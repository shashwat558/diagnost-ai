import { describe, expect, it } from "vitest";
import { buildCaseBundle, grade, type EvalCase } from "./cases.js";
import { gate } from "./eval.js";
import { offlinePatch } from "./patch.js";

const NAIVE = "Render all dates as YYYY-MM-DD.";

function conv(id: string, text: string) {
  return { conversation_id: id, text };
}

describe("buildCaseBundle", () => {
  it("derives invalid-date cases from failing evidence and dedupes them", () => {
    const bundle = buildCaseBundle(
      [
        conv("c1", "agent said booking confirmed for 2026-13-01 which is wrong"),
        conv("c2", "got a wrong date format: 2026-14-11 on my receipt"),
        conv("c3", "again 2026-13-01 shown to me"),
      ],
      [conv("p1", "my booking for 2026-07-04 was confirmed correctly")]
    );
    const ids = bundle.target.map((c) => c.id);
    expect(ids).toContain("inv_2026-13-01");
    expect(ids).toContain("inv_2026-14-11");
    expect(bundle.target.filter((c) => c.id === "inv_2026-13-01")).toHaveLength(1);
    expect(bundle.target.find((c) => c.sourceConversationId === "c2")).toBeTruthy();
    // canonical probes always included
    expect(bundle.target.some((c) => c.input.includes("2026-02-30"))).toBe(true);
    expect(bundle.heldOut.some((c) => c.input.includes("2026-07-04"))).toBe(true);
  });
});

describe("grade", () => {
  const invalid: EvalCase = { id: "x", kind: "invalid_date", input: "confirm 2026-13-05 please", sourceConversationId: null };
  const valid: EvalCase = { id: "y", kind: "valid_date", input: "confirm 2026-07-04 please", sourceConversationId: null };

  it("fails when an impossible date gets confirmed", () => {
    expect(grade(invalid, "Booking confirmed for 2026-13-05.")).toBe(false);
  });
  it("passes when an impossible date is rejected", () => {
    expect(grade(invalid, "month 13 is invalid, please check the date")).toBe(true);
  });
  it("passes only when a valid date is confirmed intact", () => {
    expect(grade(valid, "Booking confirmed for 2026-07-04.")).toBe(true);
    expect(grade(valid, "Booking confirmed for 2026-07-05.")).toBe(false);
    expect(grade(valid, "Sorry I cannot help.")).toBe(false);
  });
});

describe("gate", () => {
  const mk = (id: string, pass: boolean) => ({ caseId: id, kind: "k", pass, response: "", sourceConversationId: null });

  it("passes on strict improvement with zero regressions", () => {
    const v = gate({
      baselineResults: [mk("a", false), mk("b", false), mk("c", true)],
      patchedResults: [mk("a", true), mk("b", true), mk("c", true)],
      heldOutBaseline: [mk("h1", true)],
      heldOutPatched: [mk("h1", true)],
    });
    expect(v.passed).toBe(true);
  });

  it("blocks regressions even with improvement elsewhere", () => {
    const v = gate({
      baselineResults: [mk("a", false)],
      patchedResults: [mk("a", true)],
      heldOutBaseline: [mk("h1", true)],
      heldOutPatched: [mk("h1", false)],
    });
    expect(v.passed).toBe(false);
    expect(v.reasons.join(" ")).toMatch(/regression/);
  });

  it("blocks when nothing improved", () => {
    const v = gate({
      baselineResults: [mk("a", true)],
      patchedResults: [mk("a", true)],
      heldOutBaseline: [mk("h1", true)],
      heldOutPatched: [mk("h1", true)],
    });
    expect(v.passed).toBe(false);
  });
});

describe("offlinePatch", () => {
  it("appends validation directive to naive prompts", () => {
    const patched = offlinePatch(NAIVE)!;
    expect(patched.proposedContent).toContain("Date validation");
    expect(patched.proposedContent).toContain("month must be 1-12");
  });
  it("is idempotent — refuses to double-patch", () => {
    const once = offlinePatch(NAIVE)!;
    expect(offlinePatch(once.proposedContent)).toBeNull();
  });
});
