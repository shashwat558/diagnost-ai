import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pgQuery } from "@/lib/pg";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3100";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (!isStripeConfigured()) {
    return NextResponse.json({ ok: true, devMode: true, message: "Stripe not configured — portal unavailable in dev" });
  }

  const stripe = getStripe()!;
  const wsRows = await pgQuery<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM workspaces WHERE id=$1",
    [session.workspaceId]
  );
  const customerId = wsRows[0]?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "no_customer", message: "No Stripe customer yet — complete a checkout first" }, { status: 400 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/settings`,
  });

  return NextResponse.json({ ok: true, url: portal.url });
}
