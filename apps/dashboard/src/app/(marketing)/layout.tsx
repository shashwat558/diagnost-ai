import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
              D
            </span>
            <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Diagnost AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-600 md:flex dark:text-gray-400">
            <a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100">
              Features
            </a>
            <a href="#pricing" className="hover:text-gray-900 dark:hover:text-gray-100">
              Pricing
            </a>
            <a href="/docs" className="hover:text-gray-900 dark:hover:text-gray-100">
              Docs
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:flex" />
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Log in
            </Link>
            <Link href="/signup" className={buttonVariants({ size: "sm" })}>
              Start free
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-gray-100 py-8 dark:border-gray-800">
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
