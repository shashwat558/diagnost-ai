import Link from "next/link";

export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-semibold tracking-tight text-ink">{children}</h1>;
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 max-w-2xl text-[15px] leading-6 text-ink-muted">{children}</p>;
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-8 scroll-mt-20 text-base font-semibold text-ink">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{children}</p>;
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="my-3 max-w-3xl overflow-x-auto rounded-none border border-line bg-canvas p-3.5 font-mono text-[13px] leading-5 text-ink">
      {children}
    </pre>
  );
}

export function Inline({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-none bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">
      {children}
    </code>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 max-w-3xl rounded-none border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-sm leading-6 text-orange-900 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-200">
      {children}
    </div>
  );
}

export function DocTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="my-3 max-w-3xl overflow-x-auto rounded-none border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-canvas text-left">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-[13px] font-medium text-ink-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-[13px] leading-5 text-ink">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrevNext({ prev, next }: { prev?: { href: string; label: string }; next?: { href: string; label: string } }) {
  return (
    <div className="mt-10 flex max-w-3xl items-center justify-between border-t border-line pt-4">
      <div>
        {prev && (
          <Link href={prev.href} className="text-sm text-ink-muted hover:text-accent dark:text-ink-subtle">
            ← {prev.label}
          </Link>
        )}
      </div>
      <div>
        {next && (
          <Link href={next.href} className="text-sm font-medium text-accent hover:underline">
            {next.label} →
          </Link>
        )}
      </div>
    </div>
  );
}
