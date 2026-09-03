import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
              D
            </span>
            <span className="text-[15px] font-semibold text-gray-900">Diagnost AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-gray-600 md:flex">
            <a href="#features" className="hover:text-gray-900">
              Features
            </a>
            <a href="#pricing" className="hover:text-gray-900">
              Pricing
            </a>
            <a href="/docs" className="hover:text-gray-900">
              Docs
            </a>
          </nav>
          <div className="flex items-center gap-2">
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
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-[12px] text-gray-500 md:flex-row">
          <span>© {new Date().getFullYear()} Diagnost AI · Production analytics for AI agents</span>
          <div className="flex gap-4">
            <Link href="/docs" className="hover:text-gray-700">
              Docs
            </Link>
            <a href="https://github.com/shashwat558/diagnost-ai" className="hover:text-gray-700">
              GitHub
            </a>
            <Link href="/login" className="hover:text-gray-700">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
