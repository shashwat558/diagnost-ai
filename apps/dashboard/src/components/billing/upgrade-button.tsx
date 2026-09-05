"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/friendly-errors";

export function UpgradeButton({
  plan,
  current,
}: {
  plan: "starter" | "pro" | "enterprise" | "free";
  current?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (current) {
    return <div className="mt-2 text-[11px] font-medium text-accent">Current</div>;
  }

  const handle = async () => {
    if (plan === "enterprise") {
      window.location.href = "/docs";
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; devMode?: boolean; error?: string };
      if (!res.ok) {
        setError(friendlyError(data.error, "Couldn't start checkout. Try again."));
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else if (data.devMode) {
        // dev-mode: plan flipped directly, just refresh to see new tier
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the billing service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button variant="outline" size="sm" className="mt-2 h-6 px-2 text-[11px]" onClick={handle} disabled={busy}>
        {busy ? "…" : "Upgrade"}
      </Button>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
