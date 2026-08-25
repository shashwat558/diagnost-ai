import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Icon } from "@/components/icon";

export const metadata: Metadata = {
  title: "Diagnost AI",
  description: "Production analytics & self-improvement for AI agents",
};

const NAV = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/clusters", label: "Intents", icon: "target" },
  { href: "/features", label: "Feature requests", icon: "sparkles" },
  { href: "/models", label: "Models", icon: "activity" },
  { href: "/traces", label: "Conversations", icon: "message" },
  { href: "/audit", label: "Audit", icon: "bell" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
            <nav className="space-y-0.5 p-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                >
                  <Icon name={item.icon} className="h-4 w-4 text-gray-500" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto space-y-0.5 p-3">
              <Link
                href="/docs"
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
              >
                <Icon name="book" className="h-4 w-4 text-gray-500" />
                Docs
              </Link>
              <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-gray-700">
                <Icon name="sparkles" className="h-4 w-4 text-gray-500" />
                Auto-improve
                <span className="ml-auto inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
              >
                <Icon name="settings" className="h-4 w-4 text-gray-500" />
                Settings
              </Link>
            </div>

            <div className="border-t border-gray-200 p-3">
              <button className="flex w-full items-center gap-2.5 rounded-md border border-gray-200 px-2.5 py-2 text-left hover:bg-gray-50">
                <Icon name="database" className="h-4 w-4 text-gray-500" />
                <span className="text-[13px] font-medium text-gray-800">Diagnost AI</span>
                <span className="truncate text-[11px] text-gray-400">Dev Work…</span>
                <Icon name="chevron" className="ml-auto h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
          </aside>

          <main className="min-w-0 flex-1 bg-white">{children}</main>
        </div>
      </body>
    </html>
  );
}
