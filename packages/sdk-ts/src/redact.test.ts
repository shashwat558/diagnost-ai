import { describe, expect, it } from "vitest";
import { redactValue } from "./redact.js";

describe("redactValue", () => {
  it("hashes emails", () => {
    const r = redactValue({ msg: "contact alice@example.com please" });
    expect(r.value).toMatchObject({ msg: expect.stringContaining("[EMAIL:") });
    expect(String((r.value as { msg: string }).msg)).toMatch(/^\w+ \[EMAIL:[0-9a-f]{8}\] \w+$/);
    expect(JSON.stringify(r.value)).not.toContain("alice@example.com");
  });

  it("hashes US SSNs", () => {
    const r = redactValue({ s: "SSN 123-45-6789 on file" });
    expect(String((r.value as { s: string }).s)).not.toContain("123-45-6789");
    expect((r.value as { s: string }).s).toMatch(/\[SSN:[0-9a-f]{8}\]/);
  });

  it("hashes credit cards only when Luhn-valid", () => {
    const valid = "4111 1111 1111 1111";
    const invalid = "4111 1111 1111 1112";
    const r = redactValue({ a: `pay with ${valid}`, b: `ref ${invalid}` });
    expect(String((r.value as { a: string }).a)).toContain("[CARD:");
    expect(String((r.value as { a: string }).a)).not.toContain("4111");
    // invalid Luhn survives (likely an order number)
    expect(String((r.value as { b: string }).b)).toContain(invalid);
  });

  it("hashes phone numbers (10+ digits)", () => {
    const r = redactValue({ p: "call +1 555-867-5309 today" });
    expect(String((r.value as { p: string }).p)).toContain("[PHONE:");
    expect(String((r.value as { p: string }).p)).not.toContain("555-867-5309");
  });

  it("does not mangle small numbers or dates", () => {
    const input = "order 12345 placed on 2026-01-02 at 3pm";
    const r = redactValue({ s: input });
    expect((r.value as { s: string }).s).toBe(input);
  });

  it("heuristic NER redacts capitalized name sequences", () => {
    const r = redactValue({ note: "customer John Smith complained twice" });
    expect(String((r.value as { note: string }).note)).toContain("[NAME:");
    expect(String((r.value as { note: string }).note)).not.toContain("John Smith");
  });

  it("NER can be disabled", () => {
    const r = redactValue({ note: "customer John Smith complained" }, { nerHeuristic: false });
    expect(String((r.value as { note: string }).note)).toContain("John Smith");
  });

  it("zero-PII mode strips all strings but keeps structure", () => {
    const r = redactValue(
      { user: { email: "a@b.co" }, count: 3 },
      { zeroPiiMode: true }
    );
    expect(r.value).toEqual({
      user: { email: "[ZERO_PII]" },
      count: 3,
    });
    expect(r.findings.length).toBeGreaterThan(0);
  });

  it("custom rules apply after built-ins", () => {
    const r = redactValue({ s: "account ACC-99887" }, {
      customRules: [{ name: "ACCOUNT", pattern: /ACC-\d+/g }],
    });
    expect(String((r.value as { s: string }).s)).toContain("[ACCOUNT:");
  });

  it("audit log reports field/type/action/count without raw values", () => {
    const r = redactValue({
      a: "email bob@corp.io",
      nested: { phone: "555 867 5309" },
    });
    const types = r.findings.map((f) => `${f.type}:${f.count}`).sort();
    expect(types).toContain("email:1");
    expect(types).toContain("phone:1");
    for (const f of r.findings) {
      expect(f.field).toBeTypeOf("string");
      expect(Object.values(f).join("|")).not.toContain("@");
    }
  });

  it("normalizes array paths in audit findings", () => {
    const r = redactValue({ messages: [{ content: "hi me@x.io" }] });
    expect(r.findings[0]?.field).toContain("messages[]");
  });

  it("handles deep nesting + arrays", () => {
    const r = redactValue({
      messages: [
        { role: "user", content: "I'm Jane Doe, email jane@x.io" },
        { role: "assistant", content: "ok" },
      ],
      meta: { ids: [1, 2, 3] },
    });
    const msgs = (r.value as { messages: Array<{ content: string }> }).messages;
    expect(msgs[0]?.content).toContain("[EMAIL:");
    expect(msgs[0]?.content).toContain("[NAME:");
    expect(msgs[1]?.content).toBe("ok");
    expect((r.value as { meta: { ids: number[] } }).meta.ids).toEqual([1, 2, 3]);
  });
});
