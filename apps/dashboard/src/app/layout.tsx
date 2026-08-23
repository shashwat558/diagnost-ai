import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diagnost AI",
  description: "Production analytics & self-improvement for AI agents",
};

const nav = [
  { href: "/", label: "Overview" },
  { href: "/clusters", label: "Patterns" },
  { href: "/traces", label: "Conversations" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-edge bg-panel/60 p-4">
            <div className="mb-8 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="text-sm font-semibold tracking-wide text-slate-100">diagnost.ai</span>
            </div>
            <nav className="space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-edge hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-10 rounded-md border border-edge bg-panel p-3 text-[11px] leading-4 text-slate-400">
              PII redaction is <span className="text-accent">default-on</span>. Stored payloads are
              redacted at the SDK before they ever leave your process.
            </div>
          </aside>
          <main className="flex-1 overflow-x-hidden p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
