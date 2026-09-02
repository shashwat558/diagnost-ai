import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-bold text-white">
            D
          </span>
          <span className="text-[15px] font-semibold text-gray-900">Diagnost AI</span>
        </div>
        {children}
        <p className="mt-4 text-center text-[12px] text-gray-400">
          Production analytics &amp; self-improvement for AI agents ·{" "}
          <Link href="/docs" className="hover:text-gray-600">
            docs
          </Link>
        </p>
      </div>
    </div>
  );
}
