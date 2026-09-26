"use client";

import { useState } from "react";

export function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="ml-2 text-xs text-ink-subtle hover:text-ink"
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
