import Link from "next/link";
import { DOC_NAV } from "./nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex gap-10">
        <aside className="hidden w-52 shrink-0 md:block">
          <nav className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-5 overflow-y-auto pb-8">
            {DOC_NAV.map((group) => (
              <div key={group.section}>
                <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  {group.section}
                </div>
                <div className="mt-1 space-y-0.5">
                  {group.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="block rounded-none px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 pb-16">{children}</div>
      </div>
    </div>
  );
}
