import { NextResponse } from "next/server";
import { pgQuery } from "@/lib/pg";
import { DODO_WEBHOOK_KEY, planForProductId } from "@/lib/dodo";
import { recordAudit } from "@diagnost/db";
import { DATABASE_URL } from "@/lib/session";
import { Webhook } from "standardwebhooks";

export async function POST(req: Request) {
  const dodoKey = DODO_WEBHOOK_KEY;

  // Dev-mode: no webhook key → accept synthetic JSON { workspaceId, plan } for $0 tests
  if (!dodoKey) {
    let body: { workspaceId?: string; plan?: string; productId?: string; product_id?: string } | null = null;
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
          actor: "dodo:webhook:dev",
          action: "plan.changed",
          target: body.workspaceId,
          metadata: { to: plan, via: "webhook:dodo:dev" },
        });
        return NextResponse.json({ ok: true, devMode: true, plan });
      }
    }
    const pid = body?.productId ?? body?.product_id ?? null;
    const derived = planForProductId(pid);
    if (derived && body?.workspaceId) {
      await pgQuery("UPDATE workspaces SET plan=$1 WHERE id=$2", [derived, body.workspaceId]);
      return NextResponse.json({ ok: true, devMode: true, plan: derived });
    }
    return NextResponse.json({ ok: true, devMode: true });
  }

  // Prod: Standard Webhooks verification
  const headers = {
    "webhook-id": req.headers.get("webhook-id") ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
  };
  if (!headers["webhook-id"] || !headers["webhook-signature"] || !headers["webhook-timestamp"]) {
    return NextResponse.json({ error: "missing_webhook_headers" }, { status: 400 });
  }

  const raw = await req.text();
  try {
    const wh = new Webhook(dodoKey);
    await wh.verify(raw, headers);
  } catch (err) {
    return NextResponse.json({ error: `webhook_error: ${String(err)}` }, { status: 401 });
  }

  let payload: { type: string; data: Record<string, unknown> };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const type = payload.type;
  const data = payload.data as Record<string, unknown>;

  // Helper to extract workspace_id from metadata or customer email fallback
  const meta = (data.metadata as Record<string, string> | undefined) ?? (payload as unknown as { metadata?: Record<string,string> }).metadata;
  let workspaceId = meta?.workspace_id ?? meta?.workspaceId ?? null;
  const plan = meta?.plan ?? null;
  const productId = (data.product_id as string) ?? (data.productId as string) ?? (data.product as string) ?? null;
  const derivedPlan = plan ?? planForProductId(productId);

  // Fallback: lookup workspace by customer email if no metadata
  if (!workspaceId && data.customer) {
    const cust = data.customer as Record<string, unknown>;
    const email = (cust.email as string) ?? null;
    if (email) {
      const rows = await pgQuery<{ id: string }>("SELECT id FROM workspaces WHERE id IN (SELECT workspace_id FROM users WHERE email=$1)", [email]);
      if (rows[0]) workspaceId = rows[0].id;
    }
  }
  // Also check top-level customer object
  if (!workspaceId) {
    const custEmail = (payload.data as Record<string, unknown>).customer_email as string | undefined;
    if (custEmail) {
      const rows = await pgQuery<{ id: string }>("SELECT id FROM workspaces WHERE id IN (SELECT workspace_id FROM users WHERE email=$1)", [custEmail]);
      if (rows[0]) workspaceId = rows[0].id;
    }
  }

  if (!workspaceId) {
    // No workspace to map — ack but do nothing (maybe test event)
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Map Dodo events to plan changes
  if (type === "payment.succeeded" || type === "subscription.active" || type === "subscription.renewed" || type === "subscription.updated") {
    const targetPlan = derivedPlan;
    if (targetPlan) {
      const customerId = (data.customer_id as string) ?? (data.customerId as string) ?? null;
      const subscriptionId = (data.subscription_id as string) ?? (data.subscriptionId as string) ?? null;
      await pgQuery("UPDATE workspaces SET plan=$1, dodo_customer_id=COALESCE($2, dodo_customer_id), dodo_subscription_id=COALESCE($3, dodo_subscription_id) WHERE id=$4", [
        targetPlan,
        customerId,
        subscriptionId,
        workspaceId,
      ]);
      await recordAudit(DATABASE_URL, {
        workspaceId,
        actor: "dodo:webhook",
        action: "plan.changed",
        target: workspaceId,
        metadata: { to: targetPlan, via: type, dodo_product: productId ?? undefined },
      });
    }
  } else if (type === "subscription.cancelled" || type === "subscription.expired" || type === "subscription.failed") {
    await pgQuery("UPDATE workspaces SET plan='free' WHERE id=$1", [workspaceId]);
    await recordAudit(DATABASE_URL, {
      workspaceId,
      actor: "dodo:webhook",
      action: "plan.changed",
      target: workspaceId,
      metadata: { to: "free", via: type },
    });
  } else if (type === "subscription.on_hold" || type === "subscription.paused") {
    // on_hold — keep current plan but could notify; we downgrade to free after grace if needed
    // For now, just audit
    await recordAudit(DATABASE_URL, {
      workspaceId,
      actor: "dodo:webhook",
      action: "plan.on_hold",
      target: workspaceId,
      metadata: { via: type },
    });
  }

  return NextResponse.json({ ok: true });
}
