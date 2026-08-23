/**
 * Deterministic agent-under-test used by the offline eval loop.
 *
 * The simulator interprets a small set of prompt directives so patches have
 * observable behavioral effects without any network calls:
 *
 *   - directive RENDER_DATES ("Render ... YYYY-MM-DD") → echoes date tokens
 *     verbatim into a confirmation (no month sanity check)
 *   - directive VALIDATE_MONTHS (/validate/i + /month/) → rejects impossible
 *     months before rendering
 *
 * Grading happens against expectations derived from real conversation
 * evidence (see cases.ts); swapping this for a live LLM call only changes
 * the `simulate` function, not the harness.
 */

export interface AgentSimulator {
  readonly mode: "mock" | "openai";
  simulate(promptText: string, userInput: string): Promise<string>;
}

const DATE_TOKEN = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const VALIDATES = /validat/i;

export function parseDateToken(text: string): { raw: string; year: number; month: number; day: number } | null {
  const m = DATE_TOKEN.exec(text);
  if (!m) return null;
  return {
    raw: m[0],
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

export function isValidDate(d: { year: number; month: number; day: number }): boolean {
  if (d.month < 1 || d.month > 12) return false;
  if (d.day < 1 || d.day > 31) return false;
  const daysInMonth = new Date(Date.UTC(d.year, d.month, 0)).getUTCDate();
  return d.day <= daysInMonth;
}

function hasValidationDirective(promptText: string): boolean {
  // both signals must coexist somewhere in the prompt
  return VALIDATES.test(promptText) && /month/i.test(promptText);
}

class MockSimulator implements AgentSimulator {
  readonly mode = "mock" as const;

  async simulate(promptText: string, userInput: string): Promise<string> {
    const parsed = parseDateToken(userInput);
    if (!parsed) {
      return "Thanks! Could you share the booking date you'd like to confirm?";
    }

    if (!isValidDate(parsed)) {
      if (hasValidationDirective(promptText)) {
        return (
          `I couldn't process that booking: ${parsed.raw} has an invalid ` +
          `${parsed.month > 12 ? "month" : "day"}. Please double-check the date.`
        );
      }
      // naive renderer leaks impossible dates straight through
      return `Booking confirmed for ${parsed.raw}.`;
    }

    return `Booking confirmed for ${parsed.raw}.`;
  }
}

/** Live-model simulator: same grading contract, real prompts. */
class OpenAISimulator implements AgentSimulator {
  readonly mode = "openai" as const;

  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string
  ) {}

  async simulate(promptText: string, userInput: string): Promise<string> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: promptText },
          { role: "user", content: userInput },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message.content ?? "";
  }
}

export function makeSimulator(opts: {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): AgentSimulator {
  if (opts.provider === "openai" && opts.apiKey) {
    return new OpenAISimulator(
      opts.baseUrl ?? "https://api.openai.com/v1",
      opts.apiKey,
      opts.model ?? "gpt-4o-mini"
    );
  }
  return new MockSimulator();
}
