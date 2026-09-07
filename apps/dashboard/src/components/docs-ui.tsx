import Link from "next/link";

export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">{children}</h1>;
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 max-w-2xl text-[15px] leading-6 text-gray-600 dark:text-gray-300">{children}</p>;
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-8 scroll-mt-20 text-base font-semibold text-gray-900 dark:text-gray-100">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">{children}</p>;
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="my-3 max-w-3xl overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3.5 font-mono text-[13px] leading-5 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
      {children}
    </pre>
  );
}

export function Inline({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[12px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {children}
    </code>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 max-w-3xl rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-sm leading-6 text-violet-900 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
      {children}
    </div>
  );
}

export function DocTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="my-3 max-w-3xl overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left dark:bg-gray-900">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-[13px] leading-5 text-gray-700 dark:text-gray-300">
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
    <div className="mt-10 flex max-w-3xl items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
      <div>
        {prev && (
          <Link href={prev.href} className="text-sm text-gray-500 hover:text-accent dark:text-gray-400">
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
