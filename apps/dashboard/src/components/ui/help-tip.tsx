"use client";

/** Small "?" affordance with a hover/focus tooltip. CSS-only, keyboard-accessible. */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle" tabIndex={0}>
      <span
        className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-gray-300 text-[9px] font-medium text-gray-400 group-hover:border-gray-400 group-hover:text-gray-600"
        aria-hidden="true"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 hidden w-52 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-normal leading-4 text-gray-600 shadow-lg group-hover:block group-focus:block"
      >
        {text}
      </span>
    </span>
  );
}
