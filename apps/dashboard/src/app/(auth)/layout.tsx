import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white px-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center justify-center gap-2 text-center">
          <Link href="/" className="font-display text-2xl font-bold tracking-wider text-white">
            DIAGNOST
          </Link>
          <span className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
            Accountability Layer
          </span>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-none">
          {children}
        </div>
        <p className="mt-6 text-center font-tech text-xs text-[#999999]">
          Production analytics &amp; self-improvement for AI agents ·{" "}
          <Link href="/docs" className="text-white hover:underline">
            docs
          </Link>
        </p>
      </div>
    </div>
  );
}
