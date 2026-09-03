import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";

export default function LandingPage() {
  return (
    <div>
      {/* Hero with image background */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/hero.jpg"
            alt="Coastal meadow overlooking the ocean — calm, reliable, open horizon"
            className="h-full w-full object-cover object-center"
          />
          {/* soft overlays for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/55 to-white" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/60 via-white/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="bg-white/90 backdrop-blur">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              OpenTelemetry-native · PII redaction default-on
            </Badge>

            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-gray-900 md:text-5xl">
              Production analytics
              <br />
              <span className="text-accent">for AI agents.</span>
            </h1>

            <p className="mt-4 max-w-xl text-[15px] leading-6 text-gray-600">
              Sentry + PostHog + auto-PR-bot — purpose-built for LLM agents. Ingest traces via
              OpenTelemetry, cluster failures, detect regressions statistically, and ship self-verifying
              fixes.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonVariants({ size: "lg", className: "shadow" })}>
                Start free — 50k events/mo
              </Link>
              <Link
                href="/docs"
                className={buttonVariants({ variant: "outline", size: "lg", className: "bg-white/90 backdrop-blur" })}
              >
                View docs
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-4 text-[12px] text-gray-500">
              <span className="flex items-center gap-1.5">
                <Icon name="activity" className="h-3.5 w-3.5" /> Self-hostable
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="sparkles" className="h-3.5 w-3.5" /> Auto-remediation
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="target" className="h-3.5 w-3.5" /> EWMA/CUSUM
              </span>
            </div>

            <div className="mt-8 flex items-center gap-3 text-[12px] text-gray-400">
              <span>Works with</span>
              <span className="flex gap-2">
                <span className="rounded border bg-white px-2 py-1 text-gray-600">LangChain</span>
                <span className="rounded border bg-white px-2 py-1 text-gray-600">Vercel AI SDK</span>
                <span className="rounded border bg-white px-2 py-1 text-gray-600">MCP</span>
              </span>
            </div>
          </div>

          {/* code preview card floating over hero on larger screens */}
          <div className="mt-10 max-w-2xl rounded-lg border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur md:absolute md:right-6 md:top-20 md:mt-0 md:w-[420px]">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-gray-600">Instrument in 3 lines</span>
              <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                TypeScript
              </span>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md bg-gray-950 p-3 text-[12px] leading-5 text-gray-100">
              <code>{`import { createSpanExporter } from "@diagnost/sdk-ts";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

new NodeSDK({
  spanProcessor: new BatchSpanProcessor(
    createSpanExporter({
      endpoint: process.env.DIAGNOST_ENDPOINT,
      apiKey: process.env.DIAGNOST_API_KEY,
    })
  ),
}).start();`}</code>
            </pre>
            <p className="mt-2 text-[11px] text-gray-500">PII redaction on by default. Zero-PII mode available.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardTitle className="flex items-center gap-2">
              <Icon name="target" className="h-4 w-4 text-accent" /> Failure clustering
            </CardTitle>
            <CardDescription className="mt-1.5">
              HDBSCAN + judge pipeline groups failing conversations into ranked intents. See what breaks,
              with evidence.
            </CardDescription>
            <CardContent className="pt-3 text-[12px] text-gray-500">
              Daily sparklines, delta vs prior day, error rate, top terms.
            </CardContent>
          </Card>
          <Card>
            <CardTitle className="flex items-center gap-2">
              <Icon name="activity" className="h-4 w-4 text-accent" /> Drift detection
            </CardTitle>
            <CardDescription className="mt-1.5">
              Pooled-proportion z-gate + CUSUM. Only the spiking pattern fires — no alert fatigue.
            </CardDescription>
            <CardContent className="pt-3 text-[12px] text-gray-500">
              Statistical first pass, LLM judge second. Explainable.
            </CardContent>
          </Card>
          <Card>
            <CardTitle className="flex items-center gap-2">
              <Icon name="sparkles" className="h-4 w-4 text-accent" /> Self-verifying fixes
            </CardTitle>
            <CardDescription className="mt-1.5">
              Eval-gated auto-PRs with before/after deltas and evidence-linked cases.
            </CardDescription>
            <CardContent className="pt-3 text-[12px] text-gray-500">
              Improvement required, zero regressions allowed.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-gray-100 bg-gray-50/60 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-[15px] font-semibold text-gray-900">Simple, usage-based pricing</h2>
          <p className="mt-1 text-[13px] text-gray-500">Start free, upgrade when you need more. Self-host from Free.</p>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              { name: "Free", price: "$0", events: "50k / mo", retention: "7-day", cta: "Start free", href: "/signup", current: true },
              { name: "Starter", price: "$49", events: "250k / mo", retention: "30-day", cta: "Upgrade", href: "/signup" },
              { name: "Pro", price: "$299", events: "2M / mo", retention: "90-day", cta: "Upgrade", href: "/signup" },
              { name: "Enterprise", price: "Custom", events: "Unlimited", retention: "365-day", cta: "Contact us", href: "/docs" },
            ].map((tier) => (
              <Card key={tier.name} className={tier.current ? "border-accent/40 bg-white" : "bg-white"}>
                <div className="text-[13px] font-medium text-gray-900">{tier.name}</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{tier.price}</div>
                <div className="text-[12px] text-gray-500">
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
          <p className="mt-3 text-[11px] text-gray-400">All plans include PII redaction, audit log, and roles. Over-quota ingestion returns HTTP 402.</p>
        </div>
      </section>

      {/* Bottom CTA with subtle hero echo */}
      <section className="relative overflow-hidden border-t border-gray-100">
        <div className="absolute inset-0 opacity-20">
          <img src="/hero.jpg" alt="" className="h-full w-full object-cover object-bottom" />
        </div>
        <div className="absolute inset-0 bg-white/80" />
        <div className="relative mx-auto max-w-6xl px-6 py-10 text-center">
          <h3 className="text-[15px] font-semibold text-gray-900">Ship agents with confidence</h3>
          <p className="mx-auto mt-1 max-w-xl text-[13px] text-gray-500">
            Hosted or self-hosted. One `npx skills add` to instrument, one dashboard to see, fix, and
            improve.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/signup" className={buttonVariants({})}>
              Create workspace
            </Link>
            <Link href="/docs" className={buttonVariants({ variant: "outline", className: "bg-white" })}>
              Read quickstart
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
