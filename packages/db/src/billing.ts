/**
 * Usage-based billing: plan tiers, quota enforcement, usage metering.
 *
 * Plans gate monthly ingested event volume and retention. Enforcement is
 * fail-closed at the ingestion edge (HTTP 402 once quota is exhausted);
 * dashboards/queries are never blocked. Stripe adapter hooks in later —
 * plan changes are an authenticated admin action recorded in the audit log.
 */

export type PlanId = "free" | "starter" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  monthlyEvents: number; // hard quota for ingestion
  retentionDays: number;
  seats: number;
  priceMonthlyUsd: number;
  selfHost: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    monthlyEvents: 50_000,
    retentionDays: 7,
    seats: 3,
    priceMonthlyUsd: 0,
    selfHost: true,
  },
  starter: {
    id: "starter",
    name: "Starter",
    monthlyEvents: 250_000,
    retentionDays: 30,
    seats: 10,
    priceMonthlyUsd: 49,
    selfHost: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyEvents: 2_000_000,
    retentionDays: 90,
    seats: 50,
    priceMonthlyUsd: 299,
    selfHost: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyEvents: Number.MAX_SAFE_INTEGER,
    retentionDays: 365,
    seats: Number.MAX_SAFE_INTEGER,
    priceMonthlyUsd: -1, // custom
    selfHost: true,
  },
};

export function planFor(id: string | null | undefined): Plan {
  return PLANS[(id ?? "free") as PlanId] ?? PLANS["free"];
}

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
