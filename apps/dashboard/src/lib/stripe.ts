import Stripe from "stripe";

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
export const STRIPE_PRICE_STARTER = process.env.STRIPE_PRICE_STARTER ?? "";
export const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO ?? "";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}

export function priceIdForPlan(plan: string): string | null {
  if (plan === "starter") return STRIPE_PRICE_STARTER || null;
  if (plan === "pro") return STRIPE_PRICE_PRO || null;
  return null;
}

export function planForPriceId(priceId: string): string | null {
  if (priceId === STRIPE_PRICE_STARTER) return "starter";
  if (priceId === STRIPE_PRICE_PRO) return "pro";
  return null;
}

export function planForStripePrice(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  return planForPriceId(priceId);
}
