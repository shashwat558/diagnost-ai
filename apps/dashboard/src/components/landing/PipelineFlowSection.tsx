"use client";

import { useState } from "react";
import { SectionTag } from "@/components/landing-bits";

const STEPS = [
  {
    num: "01",
    tag: "Capture Spans",
    title: "Stream & Instrument",
    desc: "Single-line SDK wrapper. Asynchronously streams trace telemetry, tool calls, and LLM payloads without adding latency.",
    code: `import { diagnost } from "@diagnost/ai";

const agent = diagnost.wrap(openai, {
  dataset: "prod-support-agent",
  sampleRate: 1.0,
});`,
    icon: "activity",
  },
  {
    num: "02",
    tag: "Cluster & Diagnose",
    title: "AI Failure Clustering",
    desc: "Automated semantic clustering converts millions of noisy logs into structured intent issue groups with identified root causes.",
    code: `// Automated ClickHouse + HDBSCAN cluster
{
  "cluster_id": "cls_date_parse_v3",
  "intent": "date_format_error",
  "impact": "8.1% of failures",
  "remediation": "Add schema gate on LLM output"
}`,
    icon: "sparkles",
  },
  {
    num: "03",
    tag: "Gate & Replay",
    title: "Zero-Regression CI/CD",
    desc: "Every PR runs against historic failing evals. Blocks regressions before prompt or code changes reach production.",
    code: `$ npx diagnost eval --suite=regression-suite

✓ 14/14 Intent Evals Passed
✓ 0 Regressions Detected
✓ Gate Verdict: APPROVED FOR DEPLOY`,
    icon: "shield",
  },
];

export function PipelineFlowSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="space-y-8">
      <div>
        <SectionTag>Architecture Workflow</SectionTag>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em] text-ink md:text-5xl">
          Three steps to self-healing AI agents.
        </h2>
        <p className="mt-2 max-w-xl text-base text-ink-muted">
          From trace capture to automated PR gating — built for high-throughput production LLM applications.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {STEPS.map((step, idx) => {
          const isActive = activeStep === idx;
          return (
            <div
              key={step.num}
              onClick={() => setActiveStep(idx)}
              className={`group cursor-pointer p-6 bg-surface border transition-all duration-300 flex flex-col justify-between ${
                isActive
                  ? "border-brand bg-surface-2"
                  : "border-line hover:border-line-strong"
              }`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="font-tech text-xl font-bold text-ink">{step.num}</span>
                  <span className={`font-tech text-xs uppercase px-2 py-0.5 border ${
                    isActive ? "bg-brand/10 text-brand border-brand/30" : "bg-hover text-ink-muted border-line"
                  }`}>
                    {step.tag}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-xl font-semibold text-ink group-hover:text-brand transition-colors">
                  {step.title}
                </h3>
                <p className="mt-2 font-sans text-sm text-ink-muted leading-relaxed">
                  {step.desc}
                </p>
              </div>

              {/* Code snippet preview */}
              <div className="mt-6 border-t border-line pt-4">
                <pre className="p-3 bg-black text-[#e7e7e7] font-tech text-[11px] leading-relaxed overflow-x-auto border border-line">
                  {step.code}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
