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
  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800";
const NAV_ICON = "h-4 w-4 text-gray-500 dark:text-gray-400";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const isAdmin = ["owner", "admin"].includes(user.role);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <nav className="space-y-0.5 p-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={NAV_LINK}>
              <Icon name={item.icon} className={NAV_ICON} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-0.5 p-3">
          <Link href="/docs" className={NAV_LINK}>
            <Icon name="book" className={NAV_ICON} />
            Docs
          </Link>
          <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300">
            <Icon name="sparkles" className={NAV_ICON} />
            Auto-improve
            <span className="ml-auto inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
          {isAdmin &&
            ADMIN_NAV.map((item) => (
              <Link key={item.href} href={item.href} className={NAV_LINK}>
                <Icon name={item.icon} className={NAV_ICON} />
                {item.label}
              </Link>
            ))}
          <ThemeToggle className="w-full" />
        </div>

        <div className="border-t border-gray-200 p-3 dark:border-gray-800">
          <div className="flex items-center gap-2.5 rounded-md border border-gray-200 px-2.5 py-2 dark:border-gray-700">
            <Icon name="database" className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
            <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
              {user.workspaceName}
            </span>
            <span className="ml-auto shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium capitalize text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {user.role}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between px-2.5">
            <span className="truncate text-xs text-gray-400 dark:text-gray-500">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-white dark:bg-gray-950">{children}</main>
    </div>
  );
}
