"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PortalButton() {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string; devMode?: boolean };
      if (!res.ok) {
        alert(data.error ?? "Portal unavailable");
        return;
      }
      if (data.url) window.location.href = data.url;
      else alert("Billing portal not configured in dev");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={handle} disabled={busy} className="h-7 text-[12px]">
      {busy ? "…" : "Manage billing"}
    </Button>
  );
}
