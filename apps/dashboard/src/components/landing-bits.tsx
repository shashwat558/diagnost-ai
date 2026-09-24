"use client";

import { useState } from "react";
import Link from "next/link";

/** Diagonal arrow used on square CTAs. */
export function DiagonalArrow({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

/** Square primary CTA: white bg, near-black text, 0px radius. */
export function SquareCta({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-none bg-white px-5 py-3 text-base font-medium text-[#121212] transition-colors hover:bg-[#e7e7e7] ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * Status chip (v-chip): pill indicator for status reporting.
 * Dot: PASS #62c073, WARN #999999, ERROR/FAIL #ededed.
 */
export function StatusChip({ status, children }: { status: "pass" | "warn" | "fail"; children: React.ReactNode }) {
  const dot = status === "pass" ? "#62c073" : status === "warn" ? "#999999" : "#ededed";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[100px] bg-[#1f1f1f] px-2.5 py-1 font-tech text-xs uppercase text-[#999999]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
      {children}
    </span>
  );
}

/**
 * Timeline progress bar: span timing visualization.
 * Container transparent; inner bar positioned by left%/width%.
 */
export function TimelineBar({ left, width, active = false }: { left: number; width: number; active?: boolean }) {
  return (
    <span className="relative block h-1.5 w-full bg-transparent">
      <span
        className="absolute h-full rounded-sm"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          backgroundColor: active ? "#52a8ff" : "rgba(255,255,255,0.18)",
        }}
      />
    </span>
  );
}

/** Small mono section tag used above dark-tech headings. */
export function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-tech text-xs uppercase tracking-[0.2em] text-[#999999]">{children}</div>
  );
}

/** Hero backdrop: cover image + heavy bottom scrim, hides gracefully if the image file is missing. */
export function HeroBackdrop({ src, alt }: { src: string; alt: string }) {
  const [missing, setMissing] = useState(false);
  return (
    <div className="absolute inset-0 bg-black" aria-hidden>
      {!missing && (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setMissing(true)}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.76) 0%, rgba(0,0,0,0) 93.785%)" }}
      />
      {/* radial accent glow */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(60% 45% at 50% 100%, rgba(82,168,255,0.14), transparent 70%)" }}
      />
    </div>
  );
}
