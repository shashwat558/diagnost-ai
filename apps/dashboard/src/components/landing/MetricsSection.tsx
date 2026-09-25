"use client";

import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";
import { SectionTag } from "@/components/landing-bits";

const METRICS = [
  { value: 16249, decimals: 0, unit: "", label: "Trace Spans Processed", sub: "conversations clustered in the live environment" },
  { value: 8.1, decimals: 1, unit: "%", label: "Failure Rate Isolated", sub: "spiking failure pattern automatically tagged" },
  { value: 1.8, decimals: 1, unit: "s", label: "Slowest-5% Latency", sub: "P95 reply time bottleneck pinpointed" },
  { value: 100, decimals: 0, unit: "%", label: "Zero Regressions Gated", sub: "fixes verified before production merge" },
];

export function MetricsSection() {
  return (
    <div className="space-y-6">
      <Reveal>
        <SectionTag>Scale & Reliability</SectionTag>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em] text-white md:text-5xl">
          Engineered for mission-critical telemetry.
        </h2>
      </Reveal>

      <Reveal delay={100}>
        <div className="grid border border-white/10 md:grid-cols-4 bg-[#0a0a0a]">
          {METRICS.map((m, i) => (
            <div
              key={m.label}
              className={`group relative p-8 transition-all duration-300 hover:bg-white/5 ${
                i > 0 ? "border-white/10 max-md:border-t md:border-l" : ""
              }`}
            >
              <div className="font-tech text-xs uppercase tracking-wider text-[#52a8ff] mb-2 font-semibold">
                {m.label}
              </div>

              <div className="font-tech text-4xl md:text-5xl font-medium leading-none tracking-[-0.06em] text-white group-hover:text-[#52a8ff] transition-colors">
                <CountUp end={m.value} decimals={m.decimals} />
                {m.unit && <span className="ml-1 text-2xl text-[#999999]">{m.unit}</span>}
              </div>

              <div className="mt-3 font-tech text-xs leading-5 text-[#999999] group-hover:text-gray-300 transition-colors">
                {m.sub}
              </div>

              {/* Glowing hover accent line */}
              <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#52a8ff] transition-all duration-300 group-hover:w-full" />
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
