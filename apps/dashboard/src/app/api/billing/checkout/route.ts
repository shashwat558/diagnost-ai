import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pgQuery } from "@/lib/pg";
import { getStripe, isStripeConfigured, priceIdForPlan } from "@/lib/stripe";
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

  // Free — no Stripe, just downgrade directly (owner/admin only, audited)
  if (plan === "free") {
    await pgQuery("UPDATE workspaces SET plan='free' WHERE id=$1", [session.workspaceId]);
    await recordAudit(DATABASE_URL, {
      workspaceId: session.workspaceId,
      actor: session.email,
      action: "plan.changed",
      target: session.workspaceId,
      metadata: { from: session.plan, to: "free", via: "checkout:dev" },
    });
    return NextResponse.json({ ok: true, plan: "free", devMode: true });
  }

  if (plan === "enterprise") {
    return NextResponse.json({ ok: true, enterprise: true, message: "Contact sales for Enterprise" });
  }

  // Dev-mode fallback when Stripe not configured — directly set plan (so $0 demos still test quota)
  if (!isStripeConfigured()) {
    await pgQuery("UPDATE workspaces SET plan=$1 WHERE id=$2", [plan, session.workspaceId]);
    await recordAudit(DATABASE_URL, {
      workspaceId: session.workspaceId,
      actor: session.email,
      action: "plan.changed",
      target: session.workspaceId,
      metadata: { from: session.plan, to: plan, via: "checkout:dev" },
    });
    return NextResponse.json({ ok: true, plan, devMode: true });
  }

  // Stripe path
  const priceId = priceIdForPlan(plan!);
  if (!priceId) {
    return NextResponse.json({ error: "price_not_configured", plan }, { status: 500 });
  }

  const stripe = getStripe()!;
  // get or create customer
  const wsRows = await pgQuery<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM workspaces WHERE id=$1",
    [session.workspaceId]
  );
  let customerId = wsRows[0]?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      metadata: { workspace_id: session.workspaceId, workspace_name: session.workspaceName },
    });
    customerId = customer.id;
    await pgQuery("UPDATE workspaces SET stripe_customer_id=$1 WHERE id=$2", [customerId, session.workspaceId]);
  }

  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${APP_URL}/settings?checkout=success`,
    cancel_url: `${APP_URL}/settings?checkout=cancel`,
    metadata: { workspace_id: session.workspaceId, plan: plan! },
    subscription_data: { metadata: { workspace_id: session.workspaceId, plan: plan! } },
  });

  return NextResponse.json({ ok: true, url: checkout.url, devMode: false });
}
