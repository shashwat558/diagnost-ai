"use client";

import { useState } from "react";

export function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="ml-2 text-[11px] text-gray-400 hover:text-gray-700"
      title="Copy full ID"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          // clipboard unavailable — no-op
        }
      }}
    >
      {done ? "copied!" : label}
    </button>
  );
}
