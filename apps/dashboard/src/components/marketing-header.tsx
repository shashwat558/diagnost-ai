"use client";

import { useState } from "react";
import Link from "next/link";
import { DiagonalArrow } from "@/components/landing-bits";
import { ThemeToggle } from "@/components/theme-toggle";
import { Inter } from "next/font/google";

const font = Inter({
  weight: "400",
  subsets: ["latin"],
});

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="text-xl font-medium tracking-tight text-white">Diagnost</span>
    </Link>
  );
}

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className={`${font.className} absolute inset-x-0 top-[38px] z-50`}>
        <div className="flex items-center justify-between px-14 max-md:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-base text-white md:flex">
            {LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="transition-colors hover:text-[#52a8ff]">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle iconOnly className="!py-2" />
            <Link
              href="/signup"
              className="hidden items-center gap-2 rounded-none bg-white px-3 py-2 text-base font-medium text-[#121212] transition-colors hover:bg-[#e7e7e7] md:inline-flex"
            >
              Book a demo
              <DiagonalArrow className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-none border border-white/20 text-white md:hidden"
            >
              <span className="block h-px w-5 bg-white" />
              <span className="block h-px w-5 bg-white" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black px-6 pb-10 pt-[38px]">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-2">
              <ThemeToggle iconOnly />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-none border border-white/20 text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
          <nav className="mt-16 flex flex-col gap-2">
            {LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-display border-b border-white/10 py-4 text-4xl font-semibold tracking-tight text-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/signup"
            onClick={() => setOpen(false)}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-none bg-white px-5 py-4 text-lg font-medium text-[#121212]"
          >
            Book a demo
            <DiagonalArrow className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </>
  );
}
