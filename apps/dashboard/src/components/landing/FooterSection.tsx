"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

export function FooterSection() {
  return (
    <footer className="border-t border-white/10 bg-black pt-16 pb-12 font-tech text-xs text-[#999999]">
      <div className="mx-auto max-w-6xl px-6 grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Col 1: Brand & Status */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-white tracking-wider">
            <span>DIAGNOST</span>
            <span className="text-[10px] bg-[#52a8ff]/20 text-[#52a8ff] px-1.5 py-0.5 border border-[#52a8ff]/30 font-tech uppercase">
              v1.0
            </span>
          </div>
          <p className="max-w-xs text-xs text-[#999999] leading-relaxed font-sans">
            Production analytics & automated regression prevention platform for autonomous AI agents.
          </p>

          {/* System Status Pill */}
          <div className="inline-flex items-center gap-2 bg-[#0e0e0e] px-3 py-1.5 border border-white/10 text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white">All Systems Operational</span>
            <span className="text-white/40">|</span>
            <span className="text-[#999999]">Ingest P99: 12ms</span>
          </div>
        </div>

        {/* Col 2: Product */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-white font-semibold">Product</div>
          <ul className="space-y-2 font-sans text-sm">
            <li><Link href="#product" className="hover:text-white transition-colors">Span Inspector</Link></li>
            <li><Link href="#product" className="hover:text-white transition-colors">Failure Clustering</Link></li>
            <li><Link href="#product" className="hover:text-white transition-colors">Version Replay</Link></li>
            <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
          </ul>
        </div>

        {/* Col 3: Resources */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-white font-semibold">Resources</div>
          <ul className="space-y-2 font-sans text-sm">
            <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
            <li><Link href="/docs/quickstart" className="hover:text-white transition-colors">Quickstart Guide</Link></li>
            <li><Link href="/docs/api-reference" className="hover:text-white transition-colors">API Reference</Link></li>
            <li><Link href="/docs/self-host" className="hover:text-white transition-colors">Self-Hosting</Link></li>
          </ul>
        </div>

        {/* Col 4: Community */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-white font-semibold">Community</div>
          <ul className="space-y-2 font-sans text-sm">
            <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">GitHub <Icon name="external" className="h-3 w-3" /></a></li>
            <li><a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">Discord <Icon name="external" className="h-3 w-3" /></a></li>
            <li><a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">X / Twitter <Icon name="external" className="h-3 w-3" /></a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs">
        <div>© {new Date().getFullYear()} Diagnost AI Inc. All rights reserved.</div>
        <div className="flex items-center gap-6">
          <Link href="/docs" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Security</Link>
        </div>
      </div>
    </footer>
  );
}
