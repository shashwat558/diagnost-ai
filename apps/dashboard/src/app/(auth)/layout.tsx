import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas text-ink px-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center justify-center gap-2 text-center">
          <Link href="/" className="font-display text-2xl font-bold tracking-wider text-ink">
            DIAGNOST
          </Link>
          <span className="font-tech text-xs uppercase tracking-[0.2em] text-ink-muted">
            Accountability Layer
          </span>
        </div>
        <div className="bg-surface border border-line p-6 rounded-none">
          {children}
        </div>
        <p className="mt-6 text-center font-tech text-xs text-ink-muted">
          Production analytics &amp; self-improvement for AI agents ·{" "}
          <Link href="/docs" className="text-ink hover:underline">
            docs
          </Link>
        </p>
      </div>
    </div>
  );
}
