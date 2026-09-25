"use client";

import { useState } from "react";
import { SectionTag } from "@/components/landing-bits";
import { Icon } from "@/components/icon";

const CODE_EXAMPLES = {
  cli: {
    title: "CLI Quickstart",
    lang: "bash",
    code: `# Add Diagnost agent skill to your project
npx skills add diagnost

# Run local evaluation suite against baseline traces
npx diagnost eval --target=http://localhost:3100`,
  },
  ts: {
    title: "TypeScript / Next.js",
    lang: "typescript",
    code: `import { diagnost } from "@diagnost/ai";
import { OpenAI } from "openai";

const openai = new OpenAI();
export const agent = diagnost.wrap(openai, {
  dataset: "customer-support-agent",
  onFail: (trace) => diagnost.escalate(trace),
});`,
  },
  python: {
    title: "Python / LangChain",
    lang: "python",
    code: `from diagnost import DiagnostCallbackHandler
from langchain.chat_models import ChatOpenAI

diagnost_handler = DiagnostCallbackHandler(
    dataset="financial-assistant",
    auto_redact_pii=True
)

llm = ChatOpenAI(callbacks=[diagnost_handler])`,
  },
  curl: {
    title: "REST / OpenTelemetry",
    lang: "bash",
    code: `curl -X POST https://ingest.diagnost.ai/v1/spans \\
  -H "Authorization: Bearer $DIAGNOST_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"trace_id": "tr_8f91a", "status": "PASS", "latency_ms": 320}'`,
  },
};

export function IntegrationSection() {
  const [activeTab, setActiveTab] = useState<keyof typeof CODE_EXAMPLES>("cli");
  const [copied, setCopied] = useState(false);

  const activeSnippet = CODE_EXAMPLES[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <SectionTag>Developer Experience</SectionTag>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.03em] text-white md:text-5xl">
            Instrument in under 60 seconds.
          </h2>
          <p className="mt-2 max-w-xl text-base text-[#999999]">
            Works with any framework or language. Native support for OpenAI, Vercel AI SDK, LangChain, and OpenTelemetry.
          </p>
        </div>
      </div>

      {/* Code Window Box */}
      <div className="bg-[#0a0a0a] ring-1 ring-white/10 overflow-hidden">
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#121212] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-3 font-tech text-xs text-[#999999]">{activeSnippet.title}</span>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center gap-1">
            {(Object.keys(CODE_EXAMPLES) as Array<keyof typeof CODE_EXAMPLES>).map((key) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1 font-tech text-xs uppercase tracking-wider transition-colors ${
                  activeTab === key
                    ? "bg-white text-black font-bold"
                    : "text-[#999999] hover:text-white"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {/* Code Content */}
        <div className="relative p-6 bg-black font-tech text-xs md:text-sm text-gray-200 leading-relaxed overflow-x-auto">
          <button
            onClick={handleCopy}
            className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs text-white font-tech border border-white/10 transition-colors"
          >
            {copied ? (
              <>
                <span className="text-emerald-400 font-bold">✓</span> Copied
              </>
            ) : (
              <>
                <Icon name="external" className="h-3.5 w-3.5" /> Copy Snippet
              </>
            )}
          </button>
          <pre className="pr-20">{activeSnippet.code}</pre>
        </div>

        {/* Terminal Live Output Footer */}
        <div className="border-t border-white/10 bg-[#0e0e0e] px-6 py-3 font-tech text-xs text-[#999999] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>[diagnost-telemetry] Connected to endpoint: ingest.diagnost.ai</span>
          </div>
          <span className="text-[#52a8ff]">Latency: 0.4ms</span>
        </div>
      </div>
    </div>
  );
}
