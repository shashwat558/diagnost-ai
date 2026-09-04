"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UpgradeButton({
  plan,
  current,
}: {
  plan: "starter" | "pro" | "enterprise" | "free";
  current?: boolean;
}) {
  const [busy, setBusy] = useState(false);
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
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; devMode?: boolean; error?: string };
      if (!res.ok) {
        alert(data.error ?? "Checkout failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else if (data.devMode) {
        // dev-mode: plan flipped directly, just refresh to see new tier
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="mt-2 h-6 px-2 text-[11px]" onClick={handle} disabled={busy}>
      {busy ? "…" : "Upgrade"}
    </Button>
  );
}
