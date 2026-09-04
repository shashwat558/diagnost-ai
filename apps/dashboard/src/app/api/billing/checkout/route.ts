import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pgQuery } from "@/lib/pg";
import { getDodoBaseUrl, isDodoConfigured, productIdForPlan } from "@/lib/dodo";
import { DODO_API_KEY, DODO_RETURN_URL } from "@/lib/dodo";
import { recordAudit } from "@diagnost/db";
import { DATABASE_URL } from "@/lib/session";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3100";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!["owner", "admin"].includes(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const plan = body.plan?.toLowerCase();
  if (!["starter", "pro", "enterprise", "free"].includes(plan ?? "")) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  if (plan === "free") {
    await pgQuery("UPDATE workspaces SET plan='free' WHERE id=$1", [session.workspaceId]);
    await recordAudit(DATABASE_URL, {
      workspaceId: session.workspaceId,
      actor: session.email,
      action: "plan.changed",
      target: session.workspaceId,
      metadata: { from: session.plan, to: "free", via: "checkout:dodo:dev" },
    });
    return NextResponse.json({ ok: true, plan: "free", devMode: true });
  }

  if (plan === "enterprise") {
    return NextResponse.json({ ok: true, enterprise: true, message: "Contact sales for Enterprise" });
  }

  if (!isDodoConfigured()) {
    await pgQuery("UPDATE workspaces SET plan=$1 WHERE id=$2", [plan, session.workspaceId]);
    await recordAudit(DATABASE_URL, {
      workspaceId: session.workspaceId,
      actor: session.email,
      action: "plan.changed",
      target: session.workspaceId,
      metadata: { from: session.plan, to: plan, via: "checkout:dodo:dev" },
    });
    return NextResponse.json({ ok: true, plan, devMode: true });
  }

  const productId = productIdForPlan(plan!);
  if (!productId) {
    return NextResponse.json({ error: "product_not_configured", plan }, { status: 500 });
  }

  // Dodo checkouts — hosted, 24h valid, single-use
  const baseUrl = getDodoBaseUrl();
  const returnUrl = DODO_RETURN_URL || `${APP_URL}/settings?checkout=success`;

  // Ensure we have a dodo customer id stored for portal later; create lazily via checkout
  // Dodo will create customer from email if not exists
  const res = await fetch(`${baseUrl}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DODO_API_KEY}`,
    },
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: session.email, name: session.workspaceName },
      return_url: returnUrl,
      metadata: { workspace_id: session.workspaceId, plan: plan! },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return NextResponse.json({ error: "dodo_checkout_failed", details: txt.slice(0, 500) }, { status: 502 });
  }

  const data = (await res.json()) as { checkout_url?: string; session_id?: string };
  const url = data.checkout_url;
  if (!url) return NextResponse.json({ error: "no_checkout_url", data }, { status: 502 });

  return NextResponse.json({ ok: true, url, devMode: false, session_id: data.session_id });
}
