"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

export function BottomCtaSection() {
  const [copied, setCopied] = useState(false);
  const cmd = "npx skills add diagnost";

  const handleCopy = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden bg-surface px-6 py-16 text-center ring-1 ring-line">

      <div className="relative z-10 mx-auto max-w-2xl space-y-6">
        <h3 className="font-display text-3xl font-medium tracking-[-0.03em] text-ink md:text-5xl">
          Ship agents with confidence.
        </h3>
        <p className="text-base text-ink-muted leading-relaxed">
          Hosted or self-hosted. One CLI command to instrument, one unified dashboard to detect, fix, and gate regressions.
        </p>

        {/* Copy command bar */}
        <div className="inline-flex items-center justify-between gap-3 bg-surface-2 px-4 py-2.5 border border-line font-tech text-xs text-ink">
          <span className="text-brand">$</span>
          <span className="font-mono">{cmd}</span>
          <button
            onClick={handleCopy}
            className="ml-2 text-ink-muted hover:text-ink transition-colors"
            title="Copy command"
          >
            {copied ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span> : <Icon name="external" className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="pt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-none bg-ink px-8 py-3 text-base font-semibold text-canvas transition-all hover:opacity-90 hover:scale-[1.02]"
          >
            Create Workspace
          </Link>
          <Link
            href="/docs"
            className="rounded-none border border-line-strong px-8 py-3 text-base font-semibold text-ink transition-all hover:border-line hover:bg-hover"
          >
            Read Quickstart Docs
          </Link>
        </div>
      </div>
    </div>
  );
}
