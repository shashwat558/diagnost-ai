"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionTag } from "@/components/landing-bits";
import { Card } from "@/components/ui/card";

interface PricingTier {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  events: string;
  retention: string;
  cta: string;
  href: string;
  popular?: boolean;
  features: string[];
}

const TIERS: PricingTier[] = [
  {
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    events: "50k / mo",
    retention: "7-day",
    cta: "Start Free",
    href: "/signup",
    features: [
      "50,000 events / mo included",
      "7-day trace retention",
      "Client-side PII redaction",
      "Community Discord support",
      "Self-host ready",
    ],
  },
  {
    name: "Starter",
    monthlyPrice: "$49",
    annualPrice: "$39",
    events: "250k / mo",
    retention: "30-day",
    cta: "Start Starter",
    href: "/signup",
    features: [
      "250,000 events / mo included",
      "30-day trace retention",
      "Automated failure clustering",
      "Slack & Webhook alert channels",
      "3 team seat licenses",
    ],
  },
  {
    name: "Pro",
    monthlyPrice: "$299",
    annualPrice: "$239",
    events: "2M / mo",
    retention: "90-day",
    cta: "Upgrade to Pro",
    href: "/signup",
    popular: true,
    features: [
      "2,000,000 events / mo included",
      "90-day trace retention",
      "CI/CD PR automated gating",
      "Version replay & diff testing",
      "Priority 24/7 support SLA",
    ],
  },
  {
    name: "Enterprise",
    monthlyPrice: "Custom",
    annualPrice: "Custom",
    events: "Unlimited",
    retention: "365-day",
    cta: "Contact Sales",
    href: "/docs",
    features: [
      "Unlimited custom event volume",
      "365-day cold archive storage",
      "Dedicated ClickHouse cluster",
      "Custom SSO / SAML & Audit logs",
      "SOC2 Type II compliance pack",
    ],
  },
];

export function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <SectionTag>Pricing</SectionTag>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em] text-ink md:text-5xl">
            Simple, usage-based pricing.
          </h2>
          <p className="mt-2 max-w-xl text-base text-ink-muted">
            Start free, scale seamlessly. All paid plans include over-quota safety controls and self-hosting options.
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center gap-3 bg-surface-2 p-1.5 ring-1 ring-line self-start sm:self-auto">
          <button
            onClick={() => setAnnual(false)}
            className={`px-3 py-1 font-tech text-xs uppercase tracking-wider transition-colors ${
              !annual ? "bg-ink text-canvas font-bold" : "text-ink-muted hover:text-ink"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`flex items-center gap-1.5 px-3 py-1 font-tech text-xs uppercase tracking-wider transition-colors ${
              annual ? "bg-ink text-canvas font-bold" : "text-ink-muted hover:text-ink"
            }`}
          >
            Annual
            <span className="bg-brand text-canvas px-1.5 py-0.2 text-[10px] font-bold rounded-none">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {TIERS.map((tier) => {
          const price = annual ? tier.annualPrice : tier.monthlyPrice;
          const isPopular = tier.popular;

          return (
            <div key={tier.name} className="relative h-full flex">
              <Card
                className={`relative flex h-full w-full flex-col justify-between rounded-none bg-surface p-6 transition-all duration-300 ${
                  isPopular
                    ? "ring-1 ring-brand bg-surface-2"
                    : "border-line hover:border-line-strong"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-canvas px-3 py-0.5 font-tech text-[10px] font-bold uppercase tracking-widest">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="font-tech text-xs uppercase tracking-[0.2em] text-ink-muted">
                    {tier.name}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-medium tracking-tight text-ink">
                      {price}
                    </span>
                    {price !== "Custom" && (
                      <span className="font-tech text-xs text-ink-muted">/ mo</span>
                    )}
                  </div>
                  <div className="mt-1 font-tech text-xs text-brand">
                    {tier.events} · {tier.retention} retention
                  </div>

                  {/* Feature Checklist */}
                  <div className="mt-6 pt-6 border-t border-line space-y-2.5">
                    {tier.features.map((feat) => (
                      <div key={feat} className="flex items-start gap-2 font-tech text-xs text-ink-muted">
                        <span className="text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold">✓</span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <Link
                    href={tier.href}
                    className={`inline-flex w-full items-center justify-center rounded-none px-4 py-2.5 font-tech text-xs font-bold uppercase tracking-[0.15em] transition-all ${
                      isPopular
                        ? "bg-brand text-canvas hover:opacity-90"
                        : "bg-ink text-canvas hover:opacity-90"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      <p className="font-tech text-xs text-ink-muted text-center sm:text-left">
        All plans include client-side PII redaction, audit logging, and team role access. Over-quota ingestion returns HTTP 402 with soft headroom.
      </p>
    </div>
  );
}
