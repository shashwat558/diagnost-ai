import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pgQuery } from "@/lib/pg";
import { DODO_API_KEY, getDodoBaseUrl } from "@/lib/dodo";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (!DODO_API_KEY) {
    return NextResponse.json({ ok: true, devMode: true, message: "Dodo not configured — portal unavailable in dev" });
  }

  const wsRows = await pgQuery<{ dodo_customer_id: string | null }>(
    "SELECT dodo_customer_id FROM workspaces WHERE id=$1",
    [session.workspaceId]
  );
  const customerId = wsRows[0]?.dodo_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "no_customer", message: "No Dodo customer yet — complete a checkout first" }, { status: 400 });
  }

  // Dodo customer portal — via API (if available) or fallback to dashboard
  // Dodo's adaptor exposes CustomerPortal handler, but we can proxy via raw API
  // For now, try the Dodo API portal endpoint; if not available, return the Dodo dashboard URL
  const baseUrl = getDodoBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/customer-portal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DODO_API_KEY}`,
      },
      body: JSON.stringify({ customer_id: customerId }),
    });
    if (res.ok) {
      const data = (await res.json()) as { url?: string; portal_url?: string };
      const url = data.url ?? data.portal_url;
      if (url) return NextResponse.json({ ok: true, url });
    }
  } catch {
    // fall through to generic message
  }

  // Fallback: direct to Dodo customer portal (customer can manage via email link)
  return NextResponse.json({
    ok: true,
    devMode: false,
    message: "Portal not configured — manage subscription via Dodo dashboard or email",
    customerId,
  });
}
