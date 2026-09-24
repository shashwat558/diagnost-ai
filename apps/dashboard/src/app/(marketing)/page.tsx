import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  DiagonalArrow,
  HeroBackdrop,
  SectionTag,
  SquareCta,
  StatusChip,
  TimelineBar,
} from "@/components/landing-bits";
import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";

/* ------------------------------------------------------------------ */
/* Static demo data (representative trace — mirrors real product rows) */
/* ------------------------------------------------------------------ */

const SIDEBAR_EVENTS = [
  { id: "evt_8f2a41", status: "pass" as const },
  { id: "evt_8f2a42", status: "pass" as const },
  { id: "evt_8f2a43", status: "fail" as const },
  { id: "evt_8f2a44", status: "pass" as const },
  { id: "evt_8f2a45", status: "warn" as const },
  { id: "evt_8f2a46", status: "pass" as const },
  { id: "evt_8f2a47", status: "fail" as const },
  { id: "evt_8f2a48", status: "pass" as const },
];

const SPANS = [
  { name: "order.lookup", start: "t+0ms", left: 0, width: 38, active: false },
  { name: "llm.reply", start: "t+212ms", left: 22, width: 47, active: true },
  { name: "tool.refund", start: "t+640ms", left: 55, width: 30, active: false },
  { name: "checkpoint.escalate", start: "t+1.1s", left: 78, width: 22, active: false },
];

const REGRESSION_ROWS = [
  { intent: "date_format_error", status: "pass" as const, delta: "+100%", note: "0 → 14/14 evals" },
  { intent: "tool_timeout", status: "pass" as const, delta: "+42%", note: "retry guard added" },
  { intent: "billing_dispute", status: "fail" as const, delta: "-8%", note: "gate blocked the PR" },
];

const CLUSTER_BARS = [
  { intent: "date_format_error", error: 82, total: 100 },
  { intent: "tool_timeout", error: 54, total: 100 },
  { intent: "billing_dispute", error: 31, total: 100 },
];

const METRICS = [
  { value: 16249, decimals: 0, unit: "", sub: "conversations clustered in the demo" },
  { value: 8.1, decimals: 1, unit: "%", sub: "failure rate on the spiking pattern" },
  { value: 1.8, decimals: 1, unit: "s", sub: "slowest-5% reply time" },
  { value: 100, decimals: 0, unit: "%", sub: "fixes gated on zero regressions" },
];

const TIERS = [
  { name: "Free", price: "$0", events: "50k / mo", retention: "7-day", cta: "Start free", href: "/signup", current: true },
  { name: "Starter", price: "$49", events: "250k / mo", retention: "30-day", cta: "Upgrade", href: "/signup", current: false },
  { name: "Pro", price: "$299", events: "2M / mo", retention: "90-day", cta: "Upgrade", href: "/signup", current: false },
  { name: "Enterprise", price: "Custom", events: "Unlimited", retention: "365-day", cta: "Contact us", href: "/docs", current: false },
];

const cardCls =
  "rounded-none bg-[#0a0a0a] ring-1 ring-[rgba(255,255,255,0.145)] transition-transform duration-300 hover:-translate-y-1";

export default function LandingPage() {
  return (
    <div className="bg-black text-white">
      {/* ================= HERO · 100svh ================= */}
      <section className="relative flex h-[100svh] min-h-[640px] flex-col justify-end overflow-hidden">
        <HeroBackdrop src="/hero-bg.jpg" alt="" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 md:pb-20">
          <Reveal>
            <div className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
              Analytics layer for AI agents
            </div>
            <h1 className="headline-fluid mt-4 max-w-[752px] font-display font-medium tracking-[-0.03em] text-white">
              Agent work, held to account.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-6 text-[#e7e7e7]">
              Capture every agent conversation, surface the failures that matter, and ship verified
              fixes — with the evidence attached.
            </p>
            <div className="mt-7">
              <SquareCta href="/signup" className="!px-7 !py-4 !text-xl">
                Book a demo
                <DiagonalArrow className="h-3 w-3" />
              </SquareCta>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= EVENT STREAM ================= */}
      <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 md:py-28">
        <Reveal>
          <SectionTag>Live evidence</SectionTag>
          <h2 className="mt-3 max-w-xl font-display text-4xl font-medium tracking-[-0.03em] text-white md:text-5xl">
            Every span, on the record.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-6 text-[#999999]">
            One trace, fully expanded — steps, timing and outcomes, exactly as the pipeline stores
            them.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className={`${cardCls} mt-8 p-5 md:p-6`}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status="pass">trace 4bf92f35</StatusChip>
              <StatusChip status="warn">duration 1.8s</StatusChip>
              <span className="ml-auto font-tech text-xs text-[#999999]">conv_seed_3594</span>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[240px_1fr]">
              {/* event list */}
              <div className="max-h-64 overflow-y-auto pr-1">
                {SIDEBAR_EVENTS.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 border-b border-white/5 py-2 font-tech text-xs text-[#999999]"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          e.status === "pass" ? "#62c073" : e.status === "warn" ? "#999999" : "#ededed",
                      }}
                    />
                    {e.id}
                  </div>
                ))}
              </div>
              {/* span table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left">
                  <thead>
                    <tr className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
                      <th className="pb-3 pr-4 font-normal">Span</th>
                      <th className="pb-3 pr-4 font-normal">Start</th>
                      <th className="pb-3 font-normal">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SPANS.map((s) => (
                      <tr key={s.name} className="border-t border-white/5">
                        <td className="py-3 pr-4 font-tech text-xs text-white">{s.name}</td>
                        <td className="py-3 pr-4 font-tech text-xs text-[#999999]">{s.start}</td>
                        <td className="py-3">
                          <TimelineBar left={s.left} width={s.width} active={s.active} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================= BENTO ================= */}
      <section className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        <Reveal>
          <SectionTag>The accountability layer</SectionTag>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-medium tracking-[-0.03em] text-white md:text-5xl">
            The facts behind every failure
          </h2>
        </Reveal>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {/* regression */}
          <Reveal className="h-full">
            <div className={`${cardCls} flex h-full flex-col p-6`}>
              <div className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">Regression</div>
              <div className="mt-4 space-y-3">
                {REGRESSION_ROWS.map((r) => (
                  <div key={r.intent} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-tech text-xs text-white">{r.intent}</div>
                      <div className="font-tech text-xs text-[#999999]">{r.note}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-tech text-xs text-[#999999]">{r.delta}</span>
                      <StatusChip status={r.status}>{r.status === "pass" ? "PASS" : "FAIL"}</StatusChip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* failure clustering */}
          <Reveal delay={100} className="h-full">
            <div className={`${cardCls} flex h-full flex-col p-6`}>
              <div className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
                Failure clustering
              </div>
              <div className="mt-4 space-y-4">
                {CLUSTER_BARS.map((c) => (
                  <div key={c.intent}>
                    <div className="flex items-baseline justify-between font-tech text-xs">
                      <span className="text-white">{c.intent}</span>
                      <span className="text-[#999999]">{c.error}% err</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full bg-white/5">
                      <div className="flex h-full">
                        <div className="h-full bg-[#52a8ff]" style={{ width: `${c.error}%` }} />
                        <div className="h-full bg-white/15" style={{ width: `${c.total - c.error}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* version replay */}
          <Reveal delay={200} className="h-full">
            <div className={`${cardCls} flex h-full flex-col p-6`}>
              <div className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
                Version replay
              </div>
              <div className="mt-4 space-y-0 font-tech text-xs leading-6">
                <div className="border-l-2 border-[#62c073] bg-[#62c073]/5 px-3 text-white">
                  + validate month 1-12 before confirm
                </div>
                <div className="border-l-2 border-[#52a8ff] bg-[#52a8ff]/5 px-3 text-white">
                  ~ render receipt with YYYY-MM-DD
                </div>
                <div className="border-l-2 border-transparent px-3 text-[#999999]">
                  &nbsp;&nbsp;booking_assistant_prompt v2 → v3
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= METRICS ================= */}
      <section className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        <Reveal>
          <div className="grid border border-white/10 md:grid-cols-4">
            {METRICS.map((m, i) => (
              <div
                key={m.sub}
                className={`bg-black p-8 ${i > 0 ? "border-white/10 max-md:border-t md:border-l" : ""}`}
              >
                <div className="font-tech text-[56px] font-medium leading-none tracking-[-0.06em] text-white">
                  <CountUp end={m.value} decimals={m.decimals} />
                  {m.unit && <span className="ml-1 text-2xl text-[#999999]">{m.unit}</span>}
                </div>
                <div className="mt-3 font-tech text-xs leading-5 text-[#999999]">{m.sub}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ================= PRICING ================= */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-10 md:py-14">
        <Reveal>
          <SectionTag>Pricing</SectionTag>
          <h2 className="mt-3 font-display text-4xl font-medium tracking-[-0.03em] text-white md:text-5xl">
            Simple, usage-based pricing
          </h2>
          <p className="mt-3 max-w-xl text-base text-[#999999]">
            Start free, upgrade when you need more. Self-host from Free.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 80} className="h-full">
              <Card
                className={`flex h-full flex-col rounded-none border-white/[0.145] bg-[#0a0a0a] p-6 ${
                  tier.current ? "ring-1 ring-[#52a8ff]/60" : ""
                }`}
              >
                <div className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
                  {tier.name}
                </div>
                <div className="mt-2 font-display text-4xl font-medium tracking-tight text-white">
                  {tier.price}
                </div>
                <div className="mt-1 font-tech text-xs text-[#999999]">
                  {tier.events} · {tier.retention} retention
                </div>
                <Link
                  href={tier.href}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-none bg-white px-3 py-2 font-tech text-xs uppercase tracking-[0.15em] text-[#121212] transition-colors hover:bg-[#e7e7e7]"
                >
                  {tier.cta}
                </Link>
              </Card>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 font-tech text-xs text-[#999999]">
          All plans include PII redaction, audit log, and roles. Over-quota ingestion returns HTTP 402.
        </p>
      </section>

      {/* ================= BOTTOM CTA ================= */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-6">
        <Reveal>
          <div className="rounded-none bg-[#0a0a0a] px-6 py-14 text-center ring-1 ring-[rgba(255,255,255,0.145)]">
            <h3 className="mx-auto max-w-xl font-display text-4xl font-medium tracking-[-0.03em] text-white md:text-5xl">
              Ship agents with confidence
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-base text-[#999999]">
              Hosted or self-hosted. One `npx skills add` to instrument, one dashboard to see, fix,
              and improve.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-none bg-white px-6 py-3 text-base font-medium text-[#121212] transition-colors hover:bg-[#e7e7e7]"
              >
                Create workspace
              </Link>
              <Link
                href="/docs"
                className="rounded-none border border-white/20 px-6 py-3 text-base font-medium text-white transition-colors hover:border-white/40"
              >
                Read quickstart
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
