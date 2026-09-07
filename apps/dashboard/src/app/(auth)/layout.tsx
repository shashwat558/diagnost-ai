import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-bold text-white">
            D
          </span>
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Diagnost AI</span>
        </div>
        {children}
        <p className="mt-4 text-center text-sm text-gray-400 dark:text-gray-500">
          Production analytics &amp; self-improvement for AI agents ·{" "}
          <Link href="/docs" className="hover:text-gray-600">
            docs
          </Link>
        </p>
      </div>
    </div>
  );
}
