"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

export function FooterSection() {
  return (
    <footer className="border-t border-line bg-canvas pt-16 pb-12 font-tech text-xs text-ink-muted">
      <div className="mx-auto max-w-6xl px-6 grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Col 1: Brand & Status */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-ink tracking-wider">
            <span>DIAGNOST</span>
            <span className="text-[10px] bg-brand-soft text-brand px-1.5 py-0.5 border border-brand/30 font-tech uppercase">
              v1.0
            </span>
          </div>
          <p className="max-w-xs text-xs text-ink-muted leading-relaxed font-sans">
            Production analytics & automated regression prevention platform for autonomous AI agents.
          </p>

          {/* System Status Pill */}
          <div className="inline-flex items-center gap-2 bg-surface-2 px-3 py-1.5 border border-line text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-ink">All Systems Operational</span>
            <span className="text-ink-subtle">|</span>
            <span className="text-ink-muted">Ingest P99: 12ms</span>
          </div>
        </div>

        {/* Col 2: Product */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-ink font-semibold">Product</div>
          <ul className="space-y-2 font-sans text-sm">
            <li><Link href="#product" className="hover:text-ink transition-colors">Span Inspector</Link></li>
            <li><Link href="#product" className="hover:text-ink transition-colors">Failure Clustering</Link></li>
            <li><Link href="#product" className="hover:text-ink transition-colors">Version Replay</Link></li>
            <li><Link href="#pricing" className="hover:text-ink transition-colors">Pricing</Link></li>
          </ul>
        </div>

        {/* Col 3: Resources */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-ink font-semibold">Resources</div>
          <ul className="space-y-2 font-sans text-sm">
            <li><Link href="/docs" className="hover:text-ink transition-colors">Documentation</Link></li>
            <li><Link href="/docs/quickstart" className="hover:text-ink transition-colors">Quickstart Guide</Link></li>
            <li><Link href="/docs/api-reference" className="hover:text-ink transition-colors">API Reference</Link></li>
            <li><Link href="/docs/self-host" className="hover:text-ink transition-colors">Self-Hosting</Link></li>
          </ul>
        </div>

        {/* Col 4: Community */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-ink font-semibold">Community</div>
          <ul className="space-y-2 font-sans text-sm">
            <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors flex items-center gap-1">GitHub <Icon name="external" className="h-3 w-3" /></a></li>
            <li><a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors flex items-center gap-1">Discord <Icon name="external" className="h-3 w-3" /></a></li>
            <li><a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors flex items-center gap-1">X / Twitter <Icon name="external" className="h-3 w-3" /></a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 mt-12 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs">
        <div>© {new Date().getFullYear()} Diagnost AI Inc. All rights reserved.</div>
        <div className="flex items-center gap-6">
          <Link href="/docs" className="hover:text-ink transition-colors">Privacy Policy</Link>
          <Link href="/docs" className="hover:text-ink transition-colors">Terms of Service</Link>
          <Link href="/docs" className="hover:text-ink transition-colors">Security</Link>
        </div>
      </div>
    </footer>
  );
}
