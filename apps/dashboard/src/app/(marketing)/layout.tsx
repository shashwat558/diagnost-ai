import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafaf9] text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="sticky top-3 z-50 mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex h-12 items-center justify-between gap-4 rounded-none bg-zinc-800 py-1 pl-4 pr-1.5 text-white shadow-lg dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-none bg-accent text-[13px] font-bold text-white">
              D
            </span>
            <span className="text-sm font-semibold tracking-wide">DIAGNOST</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-300 md:flex">
            <a href="#product" className="hover:text-white">
              Product
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <Link href="/docs" className="hover:text-white">
              Docs
            </Link>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle iconOnly className="hidden !gap-0 !px-2 !text-gray-200 hover:!bg-gray-800 hover:!text-white sm:flex" />
            <Link
              href="/login"
              className="rounded-full px-3 py-1.5 text-sm text-gray-200 hover:bg-zinc-700 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-none bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
            >
              Start free
            </Link>
          </div>
        </header>
      </div>
      {children}
      <footer className="border-t border-gray-200 py-8 dark:border-gray-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-gray-500 md:flex-row dark:text-gray-400">
          <span>© {new Date().getFullYear()} Diagnost AI · Production analytics for AI agents</span>
          <div className="flex gap-4">
            <Link href="/docs" className="hover:text-gray-700 dark:hover:text-gray-300">
              Docs
            </Link>
            <a href="https://github.com/shashwat558/diagnost-ai" className="hover:text-gray-700 dark:hover:text-gray-300">
              GitHub
            </a>
            <Link href="/login" className="hover:text-gray-700 dark:hover:text-gray-300">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
