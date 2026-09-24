import Link from "next/link";
import { MarketingHeader } from "@/components/marketing-header";
import FireflyBackground from "@/components/FireflyBackground";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black font-display text-white antialiased">

      <FireflyBackground
        zIndex={1}
        className="absolute inset-0"
        style={{ position: "absolute" }}
      />
      <MarketingHeader />
      {children}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
          <span className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">
            © {new Date().getFullYear()} Diagnost AI
          </span>
          <div className="font-tech flex gap-6 text-xs uppercase tracking-[0.2em] text-[#999999]">
            <Link href="/docs" className="transition-colors hover:text-white">
              Docs
            </Link>
            <a
              href="https://github.com/shashwat558/diagnost-ai"
              className="transition-colors hover:text-white"
            >
              GitHub
            </a>
            <Link href="/login" className="transition-colors hover:text-white">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
