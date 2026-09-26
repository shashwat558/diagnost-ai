import Link from "next/link";
import { Icon } from "@/components/icon";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireSession } from "@/lib/session";

const NAV = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/clusters", label: "Intents", icon: "target" },
  { href: "/features", label: "Feature requests", icon: "sparkles" },
  { href: "/models", label: "Models", icon: "activity" },
  { href: "/traces", label: "Conversations", icon: "message" },
];

const ADMIN_NAV = [
  { href: "/audit", label: "Audit", icon: "bell" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const NAV_LINK =
  "flex items-center gap-2.5 rounded-none px-3 py-2 font-tech text-xs uppercase tracking-wider text-ink-muted hover:bg-hover hover:text-ink transition-colors";
const NAV_ICON = "h-4 w-4 text-ink-muted";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const isAdmin = ["owner", "admin"].includes(user.role);

  return (
    <div className="flex min-h-screen bg-canvas text-ink font-sans">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface">
        <div className="p-4 border-b border-line flex items-center gap-2 font-display text-lg font-bold text-ink tracking-wider">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span>DIAGNOST</span>
            <span className="text-[10px] bg-brand-soft text-brand px-1.5 py-0.5 border border-brand/30 font-tech uppercase">
              CONSOLE
            </span>
          </Link>
        </div>

        <nav className="space-y-0.5 p-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={NAV_LINK}>
              <Icon name={item.icon} className={NAV_ICON} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-0.5 p-3 border-t border-line">
          <Link href="/docs" className={NAV_LINK}>
            <Icon name="book" className={NAV_ICON} />
            Docs
          </Link>
          <div className="flex items-center gap-2.5 rounded-none px-3 py-2 font-tech text-xs uppercase tracking-wider text-ink-muted">
            <Icon name="sparkles" className={NAV_ICON} />
            Auto-improve
            <span className="ml-auto inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          {isAdmin &&
            ADMIN_NAV.map((item) => (
              <Link key={item.href} href={item.href} className={NAV_LINK}>
                <Icon name={item.icon} className={NAV_ICON} />
                {item.label}
              </Link>
            ))}
          <div className="pt-1">
            <ThemeToggle className="w-full justify-start" />
          </div>
        </div>

        <div className="border-t border-line p-3 bg-surface-2">
          <div className="flex items-center gap-2.5 rounded-none border border-line px-3 py-2 bg-surface-2">
            <Icon name="database" className="h-4 w-4 shrink-0 text-brand" />
            <span className="truncate font-tech text-xs text-ink">
              {user.workspaceName}
            </span>
            <span className="ml-auto shrink-0 rounded-none bg-hover px-1.5 py-0.5 font-tech text-[10px] uppercase text-ink-muted border border-line">
              {user.role}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="truncate font-tech text-[11px] text-ink-muted">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-canvas text-ink">{children}</main>
    </div>
  );
}
