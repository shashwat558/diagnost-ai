"use client";

import { useState, useEffect } from "react";
import { SectionTag, StatusChip } from "@/components/landing-bits";
import { HeroDashboard } from "@/components/hero-dashboard";
import { Icon } from "@/components/icon";

interface TraceSpan {
  id: string;
  name: string;
  duration: string;
  tokens: number;
  status: "pass" | "warn" | "fail";
  type: "llm" | "tool" | "db" | "eval";
}

const DEMO_TRACES: TraceSpan[] = [
  { id: "spn_9a1", name: "llm.chat_completion (gpt-4o)", duration: "420ms", tokens: 842, status: "pass", type: "llm" },
  { id: "spn_9a2", name: "tool.query_user_db", duration: "84ms", tokens: 120, status: "pass", type: "db" },
  { id: "spn_9a3", name: "tool.execute_refund_action", duration: "1.2s", tokens: 350, status: "fail", type: "tool" },
  { id: "spn_9a4", name: "eval.guardrail_schema_check", duration: "12ms", tokens: 45, status: "warn", type: "eval" },
];

const STREAM_FEED = [
  { time: "Just now", event: "billing_dispute.eval", status: "fail", detail: "Schema mismatch in response" },
  { time: "2s ago", event: "order.lookup", status: "pass", detail: "Returned 200 OK (38ms)" },
  { time: "5s ago", event: "date_format_error", status: "pass", detail: "Auto-remediated via v3 prompt" },
  { time: "8s ago", event: "tool_timeout", status: "warn", detail: "Retried in 640ms" },
];

export function LiveEvidenceSection() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "spans" | "feed">("dashboard");
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan>(DEMO_TRACES[2]);
  const [liveIndex, setLiveIndex] = useState(0);

  // Live simulation ticker for stream feed
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveIndex((prev) => (prev + 1) % STREAM_FEED.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* View Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <SectionTag>Live evidence</SectionTag>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em] text-white md:text-5xl">
            Every span, on the record.
          </h2>
          <p className="mt-2 max-w-xl text-sm md:text-base leading-6 text-[#999999]">
            Full timeline fidelity, expanding execution spans, payloads, and guardrail telemetry as they hit production.
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-1 bg-[#0e0e0e] p-1 ring-1 ring-white/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-3 py-1.5 font-tech text-xs uppercase tracking-wider transition-colors ${
              activeTab === "dashboard"
                ? "bg-white text-black font-semibold"
                : "text-[#999999] hover:text-white"
            }`}
          >
            <Icon name="activity" className="h-3.5 w-3.5" />
            Analytics
          </button>

          <button
            onClick={() => setActiveTab("spans")}
            className={`flex items-center gap-2 px-3 py-1.5 font-tech text-xs uppercase tracking-wider transition-colors ${
              activeTab === "spans"
                ? "bg-white text-black font-semibold"
                : "text-[#999999] hover:text-white"
            }`}
          >
            <Icon name="target" className="h-3.5 w-3.5" />
            Span Inspector
          </button>

          <button
            onClick={() => setActiveTab("feed")}
            className={`flex items-center gap-2 px-3 py-1.5 font-tech text-xs uppercase tracking-wider transition-colors ${
              activeTab === "feed"
                ? "bg-white text-black font-semibold"
                : "text-[#999999] hover:text-white"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#62c073] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#62c073]"></span>
            </span>
            Live Feed
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === "dashboard" && (
        <div className="transition-all duration-300">
          <HeroDashboard />
        </div>
      )}

      {activeTab === "spans" && (
        <div className="grid md:grid-cols-3 gap-4 bg-[#0a0a0a] ring-1 ring-white/10 p-6">
          {/* Left: Span list */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between font-tech text-xs text-[#999999] border-b border-white/10 pb-2">
              <span>Span Execution Flow</span>
              <span>Latency & Status</span>
            </div>
            {DEMO_TRACES.map((span) => {
              const isSelected = selectedSpan.id === span.id;
              return (
                <div
                  key={span.id}
                  onClick={() => setSelectedSpan(span)}
                  className={`group cursor-pointer p-3 transition-all border ${
                    isSelected
                      ? "bg-white/5 border-[#52a8ff]"
                      : "bg-[#121212] border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 font-tech text-[10px] uppercase font-bold ${
                        span.type === "llm" ? "bg-[#52a8ff]/20 text-[#52a8ff]" :
                        span.type === "tool" ? "bg-amber-500/20 text-amber-400" :
                        span.type === "db" ? "bg-purple-500/20 text-purple-400" : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {span.type}
                      </span>
                      <span className="font-tech text-xs text-white font-medium group-hover:text-[#52a8ff] transition-colors">
                        {span.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-tech text-xs text-[#999999]">{span.duration}</span>
                      <StatusChip status={span.status}>{span.status.toUpperCase()}</StatusChip>
                    </div>
                  </div>

                  {/* Latency bar preview */}
                  <div className="mt-2.5 h-1.5 w-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        span.status === "fail" ? "bg-red-500" : span.status === "warn" ? "bg-amber-400" : "bg-[#52a8ff]"
                      }`}
                      style={{
                        width: span.type === "llm" ? "65%" : span.type === "tool" ? "90%" : span.type === "db" ? "20%" : "10%",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Span Inspector */}
          <div className="bg-[#121212] border border-white/10 p-4 font-tech text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-white font-semibold uppercase tracking-wider">Span Payload</span>
              <span className="text-[#999999]">{selectedSpan.id}</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[#999999]">
                <span>Token Usage:</span>
                <span className="text-white">{selectedSpan.tokens} tokens</span>
              </div>
              <div className="flex justify-between text-[#999999]">
                <span>Execution Time:</span>
                <span className="text-white">{selectedSpan.duration}</span>
              </div>
              <div className="flex justify-between text-[#999999]">
                <span>Gate Verdict:</span>
                <StatusChip status={selectedSpan.status}>{selectedSpan.status.toUpperCase()}</StatusChip>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3">
              <span className="text-[#999999] block mb-2 font-mono">Trace Parameters:</span>
              <pre className="p-3 bg-black text-gray-300 rounded-none overflow-x-auto text-[11px] leading-relaxed border border-white/5 font-mono">
{JSON.stringify(
  {
    span_id: selectedSpan.id,
    intent: selectedSpan.name,
    eval_checks: {
      schema_valid: selectedSpan.status !== "fail",
      timeout_guard: true,
      retry_attempts: selectedSpan.status === "fail" ? 3 : 0,
    },
    metadata: {
      environment: "production",
      region: "us-east-1",
    }
  },
  null,
  2
)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {activeTab === "feed" && (
        <div className="bg-[#0a0a0a] ring-1 ring-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#62c073] animate-pulse" />
              <span className="font-tech text-xs uppercase tracking-wider text-white">Live Production Event Stream</span>
            </div>
            <span className="font-tech text-xs text-[#999999]">Streaming @ 100% sampling</span>
          </div>

          <div className="space-y-2">
            {STREAM_FEED.map((item, idx) => {
              const isLatest = idx === liveIndex;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3.5 border font-tech text-xs transition-all duration-300 ${
                    isLatest
                      ? "bg-white/10 border-white/30 translate-x-1"
                      : "bg-[#121212] border-white/5 opacity-80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#999999] w-16">{item.time}</span>
                    <span className="text-white font-medium">{item.event}</span>
                    <span className="text-[#999999] hidden sm:inline">— {item.detail}</span>
                  </div>
                  <StatusChip status={item.status as any}>{item.status.toUpperCase()}</StatusChip>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
