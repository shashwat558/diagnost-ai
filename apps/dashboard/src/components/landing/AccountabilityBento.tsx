"use client";

import { useState } from "react";
import { SectionTag, StatusChip } from "@/components/landing-bits";
import { Icon } from "@/components/icon";

const REGRESSION_ROWS = [
  { intent: "date_format_error", status: "pass" as const, delta: "+100%", note: "0 → 14/14 evals", fix: "Added ISO validator" },
  { intent: "tool_timeout", status: "pass" as const, delta: "+42%", note: "retry guard added", fix: "Exponential backoff" },
  { intent: "billing_dispute", status: "fail" as const, delta: "-8%", note: "gate blocked the PR", fix: "Action required" },
  { intent: "json_schema_parse", status: "pass" as const, delta: "+100%", note: "Zod fallback active", fix: "Strict parse" },
];

const CLUSTER_BARS = [
  { intent: "date_format_error", error: 82, count: "1,420 evals", color: "#52a8ff" },
  { intent: "tool_timeout", error: 54, count: "890 evals", color: "#ea580c" },
  { intent: "billing_dispute", error: 31, count: "412 evals", color: "#ef4444" },
  { intent: "context_window_overflow", error: 18, count: "195 evals", color: "#a855f7" },
];

export function AccountabilityBento() {
  const [activeTab, setActiveTab] = useState<"v2" | "v3">("v3");
  const [isSimulatingReplay, setIsSimulatingReplay] = useState(false);
  const [replaySuccess, setReplaySuccess] = useState(false);
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);

  const handleRunReplay = () => {
    setIsSimulatingReplay(true);
    setReplaySuccess(false);
    setTimeout(() => {
      setIsSimulatingReplay(false);
      setReplaySuccess(true);
    }, 1200);
  };

  return (
    <div className="space-y-8">
      <div>
        <SectionTag>The accountability layer</SectionTag>
        <h2 className="mt-2 max-w-2xl font-display text-3xl font-medium tracking-[-0.03em] text-white md:text-5xl">
          The facts behind every failure.
        </h2>
        <p className="mt-2 max-w-xl text-base text-[#999999]">
          No more guessing why an agent hallucinated or timed out. Diagnose, reproduce, and gate PRs automatically.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* CARD 1: Automated Regression Prevention */}
        <div className="group relative flex flex-col justify-between bg-[#0a0a0a] p-6 ring-1 ring-white/10 transition-all duration-300 hover:ring-white/25">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
                Regression Guard
              </span>
              <span className="flex items-center gap-1 font-tech text-[10px] text-[#62c073] bg-[#62c073]/10 px-2 py-0.5 border border-[#62c073]/30">
                <Icon name="shield" className="h-3 w-3" /> Active
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {REGRESSION_ROWS.map((r) => (
                <div
                  key={r.intent}
                  className="flex items-center justify-between gap-3 p-2 bg-[#121212] border border-white/5 transition-colors group-hover:border-white/10"
                >
                  <div className="min-w-0">
                    <div className="truncate font-tech text-xs text-white font-medium">{r.intent}</div>
                    <div className="font-tech text-[11px] text-[#999999]">{r.note}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-tech text-xs text-[#999999]">{r.delta}</span>
                    <StatusChip status={r.status}>{r.status === "pass" ? "PASS" : "FAIL"}</StatusChip>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 font-tech text-[11px] text-[#999999] flex items-center justify-between">
            <span>Automated PR Gate</span>
            <span className="text-white font-semibold">0 Regressions Allowed</span>
          </div>
        </div>

        {/* CARD 2: Failure Pattern Clustering */}
        <div className="group relative flex flex-col justify-between bg-[#0a0a0a] p-6 ring-1 ring-white/10 transition-all duration-300 hover:ring-white/25">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
                Failure Clustering
              </span>
              <span className="font-tech text-[10px] text-[#52a8ff] bg-[#52a8ff]/10 px-2 py-0.5 border border-[#52a8ff]/30">
                Semantic AI
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {CLUSTER_BARS.map((c) => {
                const isHovered = hoveredCluster === c.intent;
                return (
                  <div
                    key={c.intent}
                    onMouseEnter={() => setHoveredCluster(c.intent)}
                    onMouseLeave={() => setHoveredCluster(null)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-baseline justify-between font-tech text-xs">
                      <span className={`transition-colors ${isHovered ? "text-[#52a8ff] font-semibold" : "text-white"}`}>
                        {c.intent}
                      </span>
                      <span className="text-[#999999]">{c.error}% err ({c.count})</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full transition-all duration-700"
                        style={{
                          width: `${c.error}%`,
                          backgroundColor: c.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 font-tech text-[11px] text-[#999999] flex items-center justify-between">
            <span>Cluster Algorithm</span>
            <span className="text-[#52a8ff]">HDBSCAN + Embeddings</span>
          </div>
        </div>

        {/* CARD 3: Version Replay & Diff Testing */}
        <div className="group relative flex flex-col justify-between bg-[#0a0a0a] p-6 ring-1 ring-white/10 transition-all duration-300 hover:ring-white/25">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
                Version Replay
              </span>
              <div className="flex items-center gap-1 bg-[#121212] p-0.5 border border-white/10">
                <button
                  onClick={() => setActiveTab("v2")}
                  className={`px-2 py-0.5 font-tech text-[10px] ${
                    activeTab === "v2" ? "bg-white text-black font-bold" : "text-[#999999]"
                  }`}
                >
                  v2
                </button>
                <button
                  onClick={() => setActiveTab("v3")}
                  className={`px-2 py-0.5 font-tech text-[10px] ${
                    activeTab === "v3" ? "bg-white text-black font-bold" : "text-[#999999]"
                  }`}
                >
                  v3 (fixed)
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2 font-tech text-xs leading-6">
              {activeTab === "v3" ? (
                <>
                  <div className="border-l-2 border-[#62c073] bg-[#62c073]/10 p-2.5 text-white transition-all">
                    <span className="text-[#62c073] font-bold">+</span> validate month 1-12 before confirm
                  </div>
                  <div className="border-l-2 border-[#52a8ff] bg-[#52a8ff]/10 p-2.5 text-white transition-all">
                    <span className="text-[#52a8ff] font-bold">~</span> render receipt with ISO YYYY-MM-DD
                  </div>
                  <div className="border-l-2 border-white/10 bg-white/5 p-2 text-[#999999]">
                    booking_assistant_prompt v3.1.0
                  </div>
                </>
              ) : (
                <>
                  <div className="border-l-2 border-red-500 bg-red-500/10 p-2.5 text-white transition-all">
                    <span className="text-red-400 font-bold">-</span> parse freeform string directly
                  </div>
                  <div className="border-l-2 border-amber-500 bg-amber-500/10 p-2.5 text-white transition-all">
                    <span className="text-amber-400 font-bold">!</span> missing date overflow guard
                  </div>
                  <div className="border-l-2 border-white/10 bg-white/5 p-2 text-[#999999]">
                    booking_assistant_prompt v2.0.0
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between">
            <button
              onClick={handleRunReplay}
              disabled={isSimulatingReplay}
              className="w-full flex items-center justify-center gap-2 bg-white text-black px-3 py-2 font-tech text-xs uppercase tracking-wider font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <Icon name="refresh" className={`h-3.5 w-3.5 ${isSimulatingReplay ? "animate-spin" : ""}`} />
              {isSimulatingReplay ? "Replaying 50 Traces..." : replaySuccess ? "✓ Replay 100% Passed" : "Run Replay Suite"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
