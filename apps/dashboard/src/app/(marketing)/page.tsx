import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { HeroDashboard } from "@/components/hero-dashboard";

const INTEGRATIONS = ["LangChain", "Vercel AI SDK", "MCP", "OpenAI", "Anthropic"];

const STATS = [
  { value: "16K", label: "Conversations clustered in the demo" },
  { value: "1", label: "Alert fired — on the real spike only" },
  { value: "100%", label: "Fixes gated on zero regressions" },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section id="product" className="mx-auto max-w-6xl px-6 pb-10 pt-14 text-center md:pt-20">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          ANALYTICS LAYER FOR AI AGENTS
        </span>

        <h1 className="mx-auto mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-gray-950 md:text-6xl dark:text-white">
          Agent work,
          <br />
          held to account.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-base leading-6 text-gray-500 dark:text-gray-400">
          Capture every agent conversation, surface the failures that matter, and ship verified
          fixes — with the evidence attached.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-gray-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
          >
            Create workspace
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            Explore the live dashboard
          </Link>
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Free plan included · no card · first agent connected in one afternoon
        </p>

        <div className="mx-auto mt-10 max-w-5xl text-left">
          <HeroDashboard />
        </div>
      </section>

      {/* Stats + integrations */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-gray-950 p-6 text-white dark:bg-black dark:ring-1 dark:ring-gray-800">
            <p className="text-sm font-medium leading-6">
              A shared source of truth for teams shipping agents into production.
            </p>
            <p className="mt-2 text-xs text-gray-400">Built for consequential work</p>
          </div>
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white p-6 text-center ring-1 ring-gray-200/60 dark:bg-gray-900 dark:ring-gray-800"
            >
              <div className="text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 border-y border-gray-200 py-5 text-sm font-medium text-gray-400 dark:border-gray-800 dark:text-gray-500">
          {INTEGRATIONS.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </section>

      {/* Bento */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <span className="inline-flex items-center rounded-full bg-gray-200/70 px-3 py-1 text-[11px] font-medium tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          THE ACCOUNTABILITY LAYER
        </span>
        <h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-gray-950 md:text-5xl dark:text-white">
          The facts behind every failure
        </h2>
        <p className="mt-3 max-w-xl text-base leading-6 text-gray-500 dark:text-gray-400">
          Follow live traffic, inspect what broke, enforce quotas and keep an evidence record —
          without piecing the story together after an incident.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {/* big orange card */}
          <div className="rounded-2xl bg-accent p-7 text-white md:col-span-2">
            <h3 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              Catch the spike, not the noise.
            </h3>
            <p className="mt-3 max-w-md text-sm leading-6 text-orange-50">
              Failure-rate spikes stop at a named intent with the exact conversations attached.
              Flat failure rates stay quiet — no alert fatigue.
            </p>
            <p className="mt-4 text-xs text-orange-100/80">One alert on the real spike. Nothing else.</p>
          </div>

          {/* live intent map */}
          <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200/60 dark:bg-gray-900 dark:ring-gray-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-accent dark:bg-orange-950">
              <Icon name="activity" className="h-4 w-4" />
            </span>
            <h3 className="mt-3 text-base font-semibold text-gray-950 dark:text-white">Live intent map</h3>
            <p className="mt-1.5 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Know which intent is failing, what it is attempting, and how fast it is growing.
            </p>
            <div className="mt-4 rounded-lg bg-gray-950 p-3 font-mono text-[11px] leading-5">
              <div className="flex justify-between text-gray-400">
                <span>date_format_error</span>
                <span className="text-red-400">8.1% failed</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>tool_timeout</span>
                <span className="text-gray-500">2.4% failed</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>billing_dispute</span>
                <span className="text-accent">needs instruction</span>
              </div>
            </div>
          </div>

          {/* quota guardrails */}
          <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200/60 dark:bg-gray-900 dark:ring-gray-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <Icon name="shield" className="h-4 w-4" />
            </span>
            <h3 className="mt-3 text-base font-semibold text-gray-950 dark:text-white">Quota guardrails</h3>
            <p className="mt-1.5 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Limit each workspace and the month as a whole. Over-quota workspaces get HTTP 402
              before the budget is crossed.
            </p>
          </div>

          {/* evidence black card */}
          <div className="rounded-2xl bg-gray-950 p-6 text-white dark:bg-black dark:ring-1 dark:ring-gray-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-accent">
              <Icon name="message" className="h-4 w-4" />
            </span>
            <h3 className="mt-3 text-base font-semibold">Evidence that holds</h3>
            <p className="mt-1.5 text-sm leading-6 text-gray-400">
              Every failure links to its conversations. Evals gate every fix — zero regressions
              shipped.
            </p>
          </div>

          {/* history */}
          <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200/60 dark:bg-gray-900 dark:ring-gray-800">
            <h3 className="text-base font-semibold text-gray-950 dark:text-white">
              A history built for investigation
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Open any conversation to see its steps in order. Failures stay attached to their cause.
            </p>
            <div className="mt-4 space-y-1.5 rounded-lg bg-gray-50 p-3 font-mono text-[11px] dark:bg-gray-950">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>order.lookup</span>
                <span>42 ms</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>llm.reply</span>
                <span>1.2s</span>
              </div>
              <div className="flex justify-between text-red-500">
                <span>tool.refund</span>
                <span>failed</span>
              </div>
            </div>
          </div>

          {/* reliable alerts */}
          <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200/60 dark:bg-gray-900 dark:ring-gray-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <Icon name="bell" className="h-4 w-4" />
            </span>
            <h3 className="mt-3 text-base font-semibold text-gray-950 dark:text-white">Reliable alerts</h3>
            <p className="mt-1.5 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Drift scans with dedup, hourly rate limits, and one-click test delivery. Slack and
              email, on your own SMTP.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-base font-semibold text-gray-950 dark:text-gray-100">Simple, usage-based pricing</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Start free, upgrade when you need more. Self-host from Free.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            { name: "Free", price: "$0", events: "50k / mo", retention: "7-day", cta: "Start free", href: "/signup", current: true },
            { name: "Starter", price: "$49", events: "250k / mo", retention: "30-day", cta: "Upgrade", href: "/signup" },
            { name: "Pro", price: "$299", events: "2M / mo", retention: "90-day", cta: "Upgrade", href: "/signup" },
            { name: "Enterprise", price: "Custom", events: "Unlimited", retention: "365-day", cta: "Contact us", href: "/docs" },
          ].map((tier) => (
            <Card key={tier.name} className={tier.current ? "border-accent/40" : ""}>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{tier.name}</div>
              <div className="mt-1 text-2xl font-semibold text-gray-950 dark:text-white">{tier.price}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {tier.events} · {tier.retention} retention
              </div>
              <Link
                href={tier.href}
                className={buttonVariants({
                  variant: tier.current ? "default" : "outline",
                  size: "sm",
                  className: "mt-4 w-full",
                })}
              >
                {tier.cta}
              </Link>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          All plans include PII redaction, audit log, and roles. Over-quota ingestion returns HTTP 402.
        </p>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-2xl bg-gray-950 px-6 py-12 text-center text-white dark:bg-black dark:ring-1 dark:ring-gray-800">
          <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">Ship agents with confidence</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-400">
            Hosted or self-hosted. One `npx skills add` to instrument, one dashboard to see, fix,
            and improve.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-700"
            >
              Create workspace
            </Link>
            <Link
              href="/docs"
              className="rounded-full border border-gray-700 px-6 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-800"
            >
              Read quickstart
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
