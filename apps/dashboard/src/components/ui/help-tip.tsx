"use client";

/** Small "?" affordance with a hover/focus tooltip. CSS-only, keyboard-accessible. */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle" tabIndex={0}>
      <span
        className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-line-strong text-[10px] font-medium text-ink-subtle group-hover:border-brand group-hover:text-ink-muted"
        aria-hidden="true"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 hidden w-52 -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-normal leading-4 text-ink-muted shadow-lg group-hover:block group-focus:block"
      >
        {text}
      </span>
    </span>
  );
}
