import { Webhook } from "standardwebhooks";

export const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY ?? "";
export const DODO_WEBHOOK_KEY = process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "";
export const DODO_ENV = process.env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode"; // test_mode | live_mode
export const DODO_RETURN_URL = process.env.DODO_PAYMENTS_RETURN_URL ?? "";
export const DODO_PRODUCT_STARTER = process.env.DODO_PAYMENTS_PRODUCT_STARTER ?? "";
export const DODO_PRODUCT_PRO = process.env.DODO_PAYMENTS_PRODUCT_PRO ?? "";

export function isDodoConfigured(): boolean {
  return !!DODO_API_KEY;
}

export function getDodoBaseUrl(): string {
  return DODO_ENV === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

export function productIdForPlan(plan: string): string | null {
  if (plan === "starter") return DODO_PRODUCT_STARTER || null;
  if (plan === "pro") return DODO_PRODUCT_PRO || null;
  return null;
}

export function planForProductId(productId: string | null | undefined): string | null {
  if (!productId) return null;
  if (productId === DODO_PRODUCT_STARTER) return "starter";
  if (productId === DODO_PRODUCT_PRO) return "pro";
  return null;
}

// Dodo webhook verification helper (Standard Webhooks spec)
export async function verifyDodoWebhook(rawBody: string, headers: Record<string, string>): Promise<void> {
  if (!DODO_WEBHOOK_KEY) throw new Error("DODO_PAYMENTS_WEBHOOK_KEY not set");
  const wh = new Webhook(DODO_WEBHOOK_KEY);
  await wh.verify(rawBody, headers);
}

export interface DodoWebhookPayload {
  type: string;
  data: {
    product_id?: string;
    productId?: string;
    customer_id?: string;
    customerId?: string;
    subscription_id?: string;
    subscriptionId?: string;
    payment_id?: string;
    paymentId?: string;
    customer?: { email?: string };
    metadata?: Record<string, string>;
    subscription_data?: { metadata?: Record<string, string> };
    // Dodo may nest under different keys; we handle both
    [key: string]: unknown;
  };
  metadata?: Record<string, string>;
}
