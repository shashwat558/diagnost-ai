"use client";

import { useState } from "react";
import { SectionTag } from "@/components/landing-bits";
import { Icon } from "@/components/icon";

const FAQS = [
  {
    q: "Does Diagnost add any latency to my agent's LLM calls?",
    a: "No. Diagnost uses zero-copy client-side memory ring-buffers that stream trace telemetry asynchronously in background webworkers or lightweight background threads. Total ingestion overhead is < 0.4ms.",
  },
  {
    q: "Can I self-host Diagnost AI inside my own cloud / VPC?",
    a: "Yes! Diagnost is open-core. We provide official Docker Compose scripts and Kubernetes Helm charts for deploying our ingestion pipeline and ClickHouse analytics store inside your AWS, GCP, or Azure VPC.",
  },
  {
    q: "How does automated failure clustering group trace errors?",
    a: "Diagnost runs semantic embedding models and HDBSCAN density clustering on trace error logs, prompt tokens, and evaluation responses. It groups thousands of trace failures into actionable intent clusters like 'date_format_error' or 'tool_timeout'.",
  },
  {
    q: "What frameworks and AI models are supported out-of-the-box?",
    a: "Diagnost supports OpenAI SDK, Anthropic Claude SDK, Vercel AI SDK, LangChain, LlamaIndex, AutoGen, CrewAI, and open-source models (vLLM / Ollama). Any custom REST pipeline can also send OpenTelemetry standard spans.",
  },
  {
    q: "How does Diagnost handle sensitive PII in user messages?",
    a: "Diagnost SDKs ship with built-in zero-trust client-side PII redactors. Credit card numbers, SSNs, API tokens, and emails are scrubbed before payload bytes ever leave your application server.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-8">
      <div>
        <SectionTag>FAQ</SectionTag>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em] text-white md:text-5xl">
          Frequently asked questions.
        </h2>
        <p className="mt-2 max-w-xl text-base text-[#999999]">
          Everything you need to know about Diagnost AI telemetry, privacy, and infrastructure.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={faq.q}
              className={`bg-[#0a0a0a] border transition-all duration-300 ${
                isOpen ? "border-[#52a8ff] bg-[#0d0d0d]" : "border-white/10 hover:border-white/20"
              }`}
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full flex items-center justify-between p-5 text-left font-display text-lg font-medium text-white hover:text-[#52a8ff] transition-colors"
              >
                <span>{faq.q}</span>
                <span className={`transform transition-transform duration-300 text-[#52a8ff] ${isOpen ? "rotate-180" : ""}`}>
                  <Icon name="chevron" className="h-5 w-5" />
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 font-sans text-sm text-[#999999] leading-relaxed border-t border-white/5 animate-fadeIn">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
