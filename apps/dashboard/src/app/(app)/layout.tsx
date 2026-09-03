import Link from "next/link";
import { Icon } from "@/components/icon";
import { LogoutButton } from "@/components/logout-button";
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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const isAdmin = ["owner", "admin"].includes(user.role);

  return (
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
          {isAdmin &&
            ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
              >
                <Icon name={item.icon} className="h-4 w-4 text-gray-500" />
                {item.label}
              </Link>
            ))}
        </div>

        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-2.5 rounded-md border border-gray-200 px-2.5 py-2">
            <Icon name="database" className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate text-[12px] font-medium text-gray-800">
              {user.workspaceName}
            </span>
            <span className="ml-auto shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-gray-600">
              {user.role}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between px-2.5">
            <span className="truncate text-[11px] text-gray-400">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-white">{children}</main>
    </div>
  );
}
