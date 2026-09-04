import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { pgQuery } from "@/lib/pg";
import { getStripe, STRIPE_WEBHOOK_SECRET, planForStripePrice } from "@/lib/stripe";
import { recordAudit } from "@diagnost/db";
import { DATABASE_URL } from "@/lib/session";

export async function POST(req: Request) {
  const stripe = getStripe();

  // Dev-mode: no Stripe configured — accept a synthetic JSON body { workspaceId, plan }
  // so acceptance can test the plan-flip without real Stripe. This is NOT signature-verified
  // and only works when STRIPE_WEBHOOK_SECRET is unset (local/dev).
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    let body: { workspaceId?: string; plan?: string; priceId?: string } | null = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: true, devMode: true, ignored: true });
    }
    if (body?.workspaceId && body?.plan) {
      const plan = body.plan.toLowerCase();
      if (["free", "starter", "pro", "enterprise"].includes(plan)) {
        await pgQuery("UPDATE workspaces SET plan=$1 WHERE id=$2", [plan, body.workspaceId]);
        await recordAudit(DATABASE_URL, {
          workspaceId: body.workspaceId,
          actor: "stripe:webhook:dev",
          action: "plan.changed",
          target: body.workspaceId,
          metadata: { to: plan, via: "webhook:dev" },
        });
        return NextResponse.json({ ok: true, devMode: true, plan });
      }
    }
    // also allow Stripe-like event shape in dev
    const priceId = body?.priceId ?? null;
    const derived = planForStripePrice(priceId);
    if (derived && body?.workspaceId) {
      await pgQuery("UPDATE workspaces SET plan=$1 WHERE id=$2", [derived, body.workspaceId]);
      return NextResponse.json({ ok: true, devMode: true, plan: derived });
    }
    return NextResponse.json({ ok: true, devMode: true });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `webhook_error: ${String(err)}` }, { status: 400 });
  }

  // Handle relevant events
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const workspaceId = (session.metadata?.workspace_id as string) ?? null;
    const plan = (session.metadata?.plan as string) ?? null;
    const priceId = session.line_items?.data?.[0]?.price?.id ?? null;
    const derivedPlan = plan ?? planForStripePrice(priceId);
    if (workspaceId && derivedPlan) {
      await pgQuery("UPDATE workspaces SET plan=$1, stripe_customer_id=$2 WHERE id=$3", [
        derivedPlan,
        (session.customer as string) ?? null,
        workspaceId,
      ]);
      await recordAudit(DATABASE_URL, {
        workspaceId,
        actor: "stripe:webhook",
        action: "plan.changed",
        target: workspaceId,
        metadata: { to: derivedPlan, via: "checkout.session.completed", stripe_session: session.id },
      });
    }
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const workspaceId = (sub.metadata?.workspace_id as string) ?? null;
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    const derivedPlan = planForStripePrice(priceId);
    if (workspaceId) {
      const newPlan = event.type === "customer.subscription.deleted" ? "free" : derivedPlan ?? "free";
      await pgQuery("UPDATE workspaces SET plan=$1, stripe_subscription_id=$2 WHERE id=$3", [
        newPlan,
        sub.id,
        workspaceId,
      ]);
      await recordAudit(DATABASE_URL, {
        workspaceId,
        actor: "stripe:webhook",
        action: "plan.changed",
        target: workspaceId,
        metadata: { to: newPlan, via: event.type, subscription: sub.id },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
